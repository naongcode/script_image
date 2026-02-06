import { useState, useEffect } from 'react';
import {
  getScenesByScript,
  getCharactersByScript,
  getCharacter,
  updateScene,
} from '../lib/storage';
import { generateSceneImage, buildScenePrompt, IMAGE_STYLES, type ImageStyle } from '../lib/gemini';
import { saveImage, getImage, getCharacterImage } from '../lib/imageStorage';
import type { Scene, Character } from '../types';

interface Props {
  scriptId: string;
  onUpdate: () => void;
}

const IMAGES_PER_GENERATION = 3; // 한 번에 생성할 이미지 수

export default function Generate({ scriptId, onUpdate }: Props) {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [generating, setGenerating] = useState<string | null>(null);
  const [generatingProgress, setGeneratingProgress] = useState({ current: 0, total: 0 });
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState('');
  const [imageCache, setImageCache] = useState<Record<string, string>>({});
  const [charImageCache, setCharImageCache] = useState<Record<string, string>>({});
  const [selectedStyle, setSelectedStyle] = useState<ImageStyle>('realistic');

  const loadData = async () => {
    const loadedScenes = getScenesByScript(scriptId);
    setScenes(loadedScenes);
    const loadedCharacters = getCharactersByScript(scriptId);
    setCharacters(loadedCharacters);

    // 장면 이미지 캐시 로드
    const cache: Record<string, string> = {};
    for (const scene of loadedScenes) {
      for (const imageId of scene.generatedImages) {
        if (!cache[imageId] && !imageId.startsWith('data:')) {
          const imageData = await getImage(imageId);
          if (imageData) {
            cache[imageId] = imageData;
          }
        }
      }
      if (scene.selectedImage && !cache[scene.selectedImage] && !scene.selectedImage.startsWith('data:')) {
        const imageData = await getImage(scene.selectedImage);
        if (imageData) {
          cache[scene.selectedImage] = imageData;
        }
      }
    }
    setImageCache(prev => ({ ...prev, ...cache }));

    // 캐릭터 참조 이미지 캐시 로드
    const charCache: Record<string, string> = {};
    for (const char of loadedCharacters) {
      for (const imageId of char.referenceImages) {
        if (!charCache[imageId] && !imageId.startsWith('data:')) {
          const imageData = await getCharacterImage(imageId);
          if (imageData) {
            charCache[imageId] = imageData;
          }
        } else if (imageId.startsWith('data:')) {
          charCache[imageId] = imageId;
        }
      }
    }
    setCharImageCache(prev => ({ ...prev, ...charCache }));
  };

  useEffect(() => {
    loadData();
  }, [scriptId]);

  const getSceneCharacters = (scene: Scene): Character[] => {
    return scene.characterIds
      .map((id) => getCharacter(id))
      .filter((c): c is Character => !!c);
  };

  const getImageSrc = (imageIdOrData: string): string => {
    if (imageIdOrData.startsWith('data:')) {
      return imageIdOrData;
    }
    return imageCache[imageIdOrData] || '';
  };

  const getCharImageSrc = (imageIdOrData: string): string => {
    if (imageIdOrData.startsWith('data:')) {
      return imageIdOrData;
    }
    return charImageCache[imageIdOrData] || '';
  };

  const handleGenerateOne = async (scene: Scene, count: number = IMAGES_PER_GENERATION) => {
    setError('');
    setGenerating(scene.id);
    setGeneratingProgress({ current: 0, total: count });

    try {
      updateScene(scene.id, { status: 'generating' });
      await loadData();

      const sceneCharacters = getSceneCharacters(scene);

      // 캐릭터 참조 이미지 로드 (선택된 이미지 우선)
      const referenceImages: string[] = [];
      for (const char of sceneCharacters) {
        // 선택된 이미지가 있으면 먼저 추가
        if (char.selectedImage && referenceImages.length < 8) {
          const imageData = charImageCache[char.selectedImage] || (char.selectedImage.startsWith('data:') ? char.selectedImage : null);
          if (imageData) {
            referenceImages.push(imageData);
          }
        }
        // 나머지 이미지들도 추가 (선택된 이미지 제외)
        for (const imageId of char.referenceImages) {
          if (imageId !== char.selectedImage && referenceImages.length < 8) {
            const imageData = charImageCache[imageId] || (imageId.startsWith('data:') ? imageId : null);
            if (imageData) {
              referenceImages.push(imageData);
            }
          }
        }
      }

      const prompt = buildScenePrompt(
        {
          location: scene.location,
          timeOfDay: scene.timeOfDay,
          visualDescription: scene.visualDescription,
          userEditedPrompt: scene.userEditedPrompt,
        },
        sceneCharacters.map((c) => ({
          name: c.name,
          appearance: c.appearance,
          defaultOutfit: c.defaultOutfit,
        })),
        selectedStyle
      );

      const newImageIds: string[] = [];

      // 여러 이미지 생성
      for (let i = 0; i < count; i++) {
        setGeneratingProgress({ current: i + 1, total: count });

        try {
          const imageData = await generateSceneImage(prompt, referenceImages);
          const imageId = await saveImage(scene.id, scene.generatedImages.length + i, imageData);

          setImageCache(prev => ({ ...prev, [imageId]: imageData }));
          newImageIds.push(imageId);

          // Rate limiting 방지
          if (i < count - 1) {
            await new Promise((resolve) => setTimeout(resolve, 1500));
          }
        } catch (err) {
          console.error(`이미지 ${i + 1} 생성 실패:`, err);
          // 하나 실패해도 계속 진행
        }
      }

      if (newImageIds.length > 0) {
        // 현재 scene 다시 로드
        const currentScene = getScenesByScript(scriptId).find(s => s.id === scene.id);
        const existingImages = currentScene?.generatedImages || [];

        updateScene(scene.id, {
          generatedImages: [...existingImages, ...newImageIds],
          selectedImage: newImageIds[0], // 첫 번째를 기본 선택
          status: 'completed',
        });
      } else {
        throw new Error('이미지 생성에 모두 실패했습니다.');
      }

      await loadData();
      onUpdate();
    } catch (err) {
      console.error('이미지 생성 실패:', err);
      setError(err instanceof Error ? err.message : '이미지 생성 중 오류가 발생했습니다.');
      updateScene(scene.id, { status: 'failed' });
      await loadData();
    } finally {
      setGenerating(null);
      setGeneratingProgress({ current: 0, total: 0 });
    }
  };

  const handleSelectImage = (sceneId: string, imageId: string) => {
    updateScene(sceneId, { selectedImage: imageId });
    loadData();
  };

  const handleGenerateAll = async () => {
    const pendingScenes = scenes.filter(
      (s) => s.status === 'pending' || s.status === 'failed'
    );

    if (pendingScenes.length === 0) {
      setError('생성할 장면이 없습니다.');
      return;
    }

    setError('');
    setProgress({ current: 0, total: pendingScenes.length });

    for (let i = 0; i < pendingScenes.length; i++) {
      const scene = pendingScenes[i];
      setProgress({ current: i + 1, total: pendingScenes.length });

      try {
        await handleGenerateOne(scene);
      } catch (err) {
        console.error(`장면 ${scene.sceneNumber} 생성 실패:`, err);
      }

      if (i < pendingScenes.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    setProgress({ current: 0, total: 0 });
  };

  const completedCount = scenes.filter((s) => s.status === 'completed').length;
  const pendingCount = scenes.filter(
    (s) => s.status === 'pending' || s.status === 'failed'
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">이미지 생성</h2>
          <p className="text-sm text-gray-500">
            완료: {completedCount}/{scenes.length} · 대기: {pendingCount} · 장면당 {IMAGES_PER_GENERATION}장 생성
          </p>
        </div>
        <button
          onClick={handleGenerateAll}
          disabled={generating !== null || pendingCount === 0}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 transition"
        >
          {progress.total > 0
            ? `생성 중... (${progress.current}/${progress.total})`
            : '전체 생성'}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg">{error}</div>
      )}

      {/* 화풍 선택 */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="font-medium text-gray-800 mb-3">화풍 선택</h3>
        <div className="grid grid-cols-5 gap-3">
          {IMAGE_STYLES.map((style) => (
            <button
              key={style.id}
              onClick={() => setSelectedStyle(style.id)}
              disabled={generating !== null}
              className={`p-3 rounded-lg border-2 transition text-center ${
                selectedStyle === style.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              } ${generating !== null ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="font-medium text-gray-800">{style.name}</div>
              <div className="text-xs text-gray-500 mt-1 line-clamp-2">{style.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 캐릭터 참조 이미지 요약 */}
      <div className="bg-yellow-50 p-4 rounded-lg">
        <h3 className="font-medium text-yellow-800 mb-2">캐릭터 참조 이미지 (선택된 이미지 우선 사용)</h3>
        <div className="flex flex-wrap gap-4">
          {characters.map((char) => {
            // 선택된 이미지 또는 첫 번째 이미지
            const displayImageId = char.selectedImage || char.referenceImages[0];
            const displayImageSrc = displayImageId ? getCharImageSrc(displayImageId) : '';
            return (
              <div key={char.id} className="flex items-center gap-2">
                {displayImageSrc ? (
                  <img
                    src={displayImageSrc}
                    alt={char.name}
                    className={`w-10 h-10 rounded-full object-cover ${char.selectedImage ? 'border-2 border-blue-500' : ''}`}
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-sm">
                    {char.name[0]}
                  </div>
                )}
                <span className="text-sm text-yellow-700">
                  {char.name} ({char.referenceImages.length}/8)
                  {char.selectedImage && <span className="text-blue-600 ml-1">*</span>}
                </span>
              </div>
            );
          })}
        </div>
        {characters.some((c) => c.referenceImages.length === 0) && (
          <p className="text-xs text-yellow-600 mt-2">
            참조 이미지가 없는 캐릭터가 있습니다. 캐릭터 탭에서 추가하세요.
          </p>
        )}
      </div>

      {/* 장면 목록 */}
      <div className="space-y-6">
        {scenes.map((scene) => (
          <SceneGenerateCard
            key={scene.id}
            scene={scene}
            characters={getSceneCharacters(scene)}
            isGenerating={generating === scene.id}
            generatingProgress={generating === scene.id ? generatingProgress : null}
            onGenerate={() => handleGenerateOne(scene)}
            onSelectImage={(imageId) => handleSelectImage(scene.id, imageId)}
            getImageSrc={getImageSrc}
          />
        ))}
      </div>
    </div>
  );
}

function SceneGenerateCard({
  scene,
  characters,
  isGenerating,
  generatingProgress,
  onGenerate,
  onSelectImage,
  getImageSrc,
}: {
  scene: Scene;
  characters: Character[];
  isGenerating: boolean;
  generatingProgress: { current: number; total: number } | null;
  onGenerate: () => void;
  onSelectImage: (imageId: string) => void;
  getImageSrc: (id: string) => string;
}) {
  const getStatusColor = (status: Scene['status']) => {
    const colors = {
      pending: 'border-gray-300',
      generating: 'border-yellow-400',
      completed: 'border-green-400',
      failed: 'border-red-400',
    };
    return colors[status];
  };

  const selectedImageSrc = scene.selectedImage ? getImageSrc(scene.selectedImage) : '';

  return (
    <div
      className={`bg-white rounded-lg shadow border-l-4 ${getStatusColor(scene.status)} p-4`}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-800">
            장면 {scene.sceneNumber}
            {scene.title && `: ${scene.title}`}
          </h3>
          <p className="text-sm text-gray-500">
            {scene.location} · {scene.timeOfDay}
          </p>
          <div className="flex items-center gap-2 mt-1">
            {characters.map((char) => (
              <span
                key={char.id}
                className="text-xs bg-gray-100 px-2 py-1 rounded"
              >
                {char.name}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2 items-end">
          <button
            onClick={onGenerate}
            disabled={isGenerating}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 disabled:bg-blue-300 transition"
          >
            {isGenerating
              ? generatingProgress
                ? `생성 중... (${generatingProgress.current}/${generatingProgress.total})`
                : '생성 중...'
              : scene.generatedImages.length > 0
                ? '추가 생성'
                : '생성'}
          </button>
          {selectedImageSrc && (
            <a
              href={selectedImageSrc}
              download={`scene_${scene.sceneNumber}.png`}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-center hover:bg-gray-50 transition"
            >
              선택 이미지 다운로드
            </a>
          )}
        </div>
      </div>

      {/* 이미지 갤러리 */}
      {scene.generatedImages.length > 0 ? (
        <div className="grid grid-cols-3 gap-4">
          {scene.generatedImages.map((imageId, index) => {
            const imageSrc = getImageSrc(imageId);
            const isSelected = scene.selectedImage === imageId;

            return (
              <div
                key={imageId}
                onClick={() => onSelectImage(imageId)}
                className={`relative cursor-pointer rounded-lg overflow-hidden border-4 transition ${
                  isSelected ? 'border-blue-500 shadow-lg' : 'border-transparent hover:border-gray-300'
                }`}
              >
                {imageSrc ? (
                  <img
                    src={imageSrc}
                    alt={`장면 ${scene.sceneNumber} - ${index + 1}`}
                    className="w-full aspect-square object-cover"
                  />
                ) : (
                  <div className="w-full aspect-square bg-gray-100 flex items-center justify-center">
                    <span className="text-gray-400">로딩 중...</span>
                  </div>
                )}
                {isSelected && (
                  <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded">
                    선택됨
                  </div>
                )}
                <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                  #{index + 1}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex items-center justify-center h-48 bg-gray-50 rounded-lg">
          <div className="text-center text-gray-400">
            <p className="text-4xl mb-2">🎬</p>
            <p>아직 생성된 이미지가 없습니다</p>
            <p className="text-sm">생성 버튼을 클릭하세요</p>
          </div>
        </div>
      )}

      {/* 장면 설명 */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-600">{scene.visualDescription}</p>
      </div>
    </div>
  );
}
