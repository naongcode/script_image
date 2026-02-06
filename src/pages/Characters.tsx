import { useState, useEffect, useRef } from 'react';
import { getCharactersByScript, updateCharacter } from '../lib/storage';
import { generateSceneImage, IMAGE_STYLES, type ImageStyle } from '../lib/gemini';
import { saveCharacterImage, getCharacterImage, deleteCharacterImage } from '../lib/imageStorage';
import type { Character } from '../types';

interface Props {
  scriptId: string;
  onUpdate: () => void;
}

const IMAGES_PER_CHARACTER = 3;

export default function Characters({ scriptId, onUpdate }: Props) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedStyle, setSelectedStyle] = useState<ImageStyle>('realistic');
  const [generating, setGenerating] = useState<string | null>(null);
  const [generatingProgress, setGeneratingProgress] = useState({ current: 0, total: 0 });
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState('');
  // 이미지 캐시 (IndexedDB에서 로드한 이미지)
  const [imageCache, setImageCache] = useState<Record<string, string>>({});

  const loadCharacters = async () => {
    const chars = getCharactersByScript(scriptId);
    setCharacters(chars);

    // 이미지 캐시 로드
    const cache: Record<string, string> = {};
    for (const char of chars) {
      for (const imageId of char.referenceImages) {
        if (!cache[imageId] && !imageId.startsWith('data:')) {
          const imageData = await getCharacterImage(imageId);
          if (imageData) {
            cache[imageId] = imageData;
          }
        } else if (imageId.startsWith('data:')) {
          cache[imageId] = imageId;
        }
      }
    }
    setImageCache((prev) => ({ ...prev, ...cache }));
  };

  useEffect(() => {
    loadCharacters();
  }, [scriptId]);

  const handleUpdateCharacter = (id: string, updates: Partial<Character>) => {
    updateCharacter(id, updates);
    loadCharacters();
    onUpdate();
  };

  const getImageSrc = (imageId: string): string => {
    if (imageId.startsWith('data:')) {
      return imageId;
    }
    return imageCache[imageId] || '';
  };

  const handleGenerateCharacterImages = async (character: Character) => {
    setError('');
    setGenerating(character.id);
    setGeneratingProgress({ current: 0, total: IMAGES_PER_CHARACTER });

    try {
      const newImageIds: string[] = [];
      const app = character.appearance;

      const styleModifier = getStyleModifier(selectedStyle);
      const prompt = `${styleModifier}

CHARACTER PORTRAIT - Full body or upper body shot

Character Details:
- Name: ${character.name}
- Age: ${app.age || 'young adult'}
- Gender: ${app.gender || 'unspecified'}
- Hair: ${app.hair || 'natural hair'}
- Face: ${app.face || 'attractive features'}
- Skin tone: ${app.skinTone || 'natural'}
- Height: ${app.height || 'average'}
- Outfit: ${character.defaultOutfit || 'casual modern clothes'}
${app.features?.length ? `- Features: ${app.features.join(', ')}` : ''}

REQUIREMENTS:
- Clear, well-lit portrait suitable for character reference
- Neutral background or simple setting
- Character facing camera or 3/4 view
- High quality, detailed rendering
- Consistent with the specified art style`;

      for (let i = 0; i < IMAGES_PER_CHARACTER; i++) {
        setGeneratingProgress({ current: i + 1, total: IMAGES_PER_CHARACTER });

        try {
          const imageData = await generateSceneImage(prompt, []);

          // IndexedDB에 저장
          const imageId = await saveCharacterImage(
            character.id,
            character.referenceImages.length + i,
            imageData
          );

          newImageIds.push(imageId);

          // 캐시 업데이트
          setImageCache((prev) => ({ ...prev, [imageId]: imageData }));

          // Rate limiting
          if (i < IMAGES_PER_CHARACTER - 1) {
            await new Promise((resolve) => setTimeout(resolve, 1500));
          }
        } catch (err) {
          console.error(`캐릭터 이미지 ${i + 1} 생성 실패:`, err);
        }
      }

      if (newImageIds.length > 0) {
        // localStorage에는 이미지 ID만 저장, 첫 이미지가 없으면 선택
        const updates: Partial<Character> = {
          referenceImages: [...character.referenceImages, ...newImageIds].slice(0, 8),
        };
        if (!character.selectedImage) {
          updates.selectedImage = newImageIds[0];
        }
        handleUpdateCharacter(character.id, updates);
      } else {
        throw new Error('이미지 생성에 모두 실패했습니다.');
      }
    } catch (err) {
      console.error('캐릭터 이미지 생성 실패:', err);
      setError(err instanceof Error ? err.message : '이미지 생성 중 오류가 발생했습니다.');
    } finally {
      setGenerating(null);
      setGeneratingProgress({ current: 0, total: 0 });
    }
  };

  // 전체 캐릭터 이미지 생성
  const handleGenerateAll = async () => {
    // 이미지가 없거나 8개 미만인 캐릭터만 대상
    const targetCharacters = characters.filter(c => c.referenceImages.length < 8);

    if (targetCharacters.length === 0) {
      setError('생성할 캐릭터가 없습니다. (모든 캐릭터가 이미 8개의 이미지를 가지고 있습니다)');
      return;
    }

    setError('');
    setBatchProgress({ current: 0, total: targetCharacters.length });

    for (let i = 0; i < targetCharacters.length; i++) {
      const char = targetCharacters[i];
      setBatchProgress({ current: i + 1, total: targetCharacters.length });

      try {
        // 최신 캐릭터 정보 다시 로드
        const freshChars = getCharactersByScript(scriptId);
        const freshChar = freshChars.find(c => c.id === char.id);
        if (freshChar && freshChar.referenceImages.length < 8) {
          await handleGenerateCharacterImages(freshChar);
        }
      } catch (err) {
        console.error(`캐릭터 ${char.name} 이미지 생성 실패:`, err);
      }

      // 캐릭터 간 딜레이
      if (i < targetCharacters.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    setBatchProgress({ current: 0, total: 0 });
  };

  const pendingCount = characters.filter(c => c.referenceImages.length === 0).length;
  const partialCount = characters.filter(c => c.referenceImages.length > 0 && c.referenceImages.length < 8).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">캐릭터 목록</h2>
          <p className="text-sm text-gray-500">
            캐릭터 이미지를 생성하거나 직접 업로드하세요. 장면 생성 시 일관성 유지에 사용됩니다.
          </p>
          <p className="text-sm text-gray-400">
            이미지 없음: {pendingCount} · 추가 가능: {partialCount} · 캐릭터당 {IMAGES_PER_CHARACTER}장 생성
          </p>
        </div>
        <button
          onClick={handleGenerateAll}
          disabled={generating !== null || (pendingCount === 0 && partialCount === 0)}
          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 transition"
        >
          {batchProgress.total > 0
            ? `전체 생성 중... (${batchProgress.current}/${batchProgress.total})`
            : '전체 캐릭터 생성'}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg">{error}</div>
      )}

      {/* 화풍 선택 */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="font-medium text-gray-800 mb-3">캐릭터 생성 화풍</h3>
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
            </button>
          ))}
        </div>
      </div>

      {characters.length === 0 ? (
        <div className="text-center py-8 bg-white rounded-lg shadow">
          <p className="text-gray-500">분석된 캐릭터가 없습니다.</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {characters.map((char) => (
            <CharacterCard
              key={char.id}
              character={char}
              isGenerating={generating === char.id}
              generatingProgress={generating === char.id ? generatingProgress : null}
              onUpdate={(updates) => handleUpdateCharacter(char.id, updates)}
              onGenerate={() => handleGenerateCharacterImages(char)}
              onSelectImage={(imageId) => handleUpdateCharacter(char.id, { selectedImage: imageId })}
              getImageSrc={getImageSrc}
              imageCache={imageCache}
              setImageCache={setImageCache}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function getStyleModifier(style: ImageStyle): string {
  switch (style) {
    case 'realistic':
      return 'Photorealistic portrait, high-resolution photograph, natural lighting, realistic skin texture, shot on professional camera, 8K quality';
    case 'anime':
      return 'Japanese anime style character, vibrant colors, clean line art, expressive eyes, detailed shading';
    case 'cinematic':
      return 'Cinematic portrait, dramatic lighting, shallow depth of field, film grain, Hollywood production quality';
    case 'watercolor':
      return 'Soft watercolor portrait, delicate brush strokes, gentle color blending, artistic and dreamy';
    case 'comic':
      return 'Comic book style character, bold outlines, dynamic pose, graphic novel aesthetic, cel shading';
    default:
      return 'High quality character illustration';
  }
}

function CharacterCard({
  character,
  isGenerating,
  generatingProgress,
  onUpdate,
  onGenerate,
  onSelectImage,
  getImageSrc,
  imageCache,
  setImageCache,
}: {
  character: Character;
  isGenerating: boolean;
  generatingProgress: { current: number; total: number } | null;
  onUpdate: (updates: Partial<Character>) => void;
  onGenerate: () => void;
  onSelectImage: (imageId: string) => void;
  getImageSrc: (id: string) => string;
  imageCache: Record<string, string>;
  setImageCache: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: character.name,
    appearance: { ...character.appearance },
    defaultOutfit: character.defaultOutfit || '',
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const remainingSlots = 8 - character.referenceImages.length;
    const filesToProcess = Array.from(files).slice(0, remainingSlots);

    for (const file of filesToProcess) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;

        // IndexedDB에 저장
        const imageId = await saveCharacterImage(
          character.id,
          character.referenceImages.length,
          base64
        );

        // 캐시 업데이트
        setImageCache((prev) => ({ ...prev, [imageId]: base64 }));

        // localStorage에는 ID만 저장, 첫 이미지면 선택
        const updates: Partial<Character> = {
          referenceImages: [...character.referenceImages, imageId],
        };
        if (!character.selectedImage) {
          updates.selectedImage = imageId;
        }
        onUpdate(updates);
      };
      reader.readAsDataURL(file);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = async (index: number) => {
    const imageId = character.referenceImages[index];

    // IndexedDB에서 삭제
    if (!imageId.startsWith('data:')) {
      await deleteCharacterImage(imageId);
    }

    const newImages = character.referenceImages.filter((_, i) => i !== index);
    const updates: Partial<Character> = { referenceImages: newImages };

    // 선택된 이미지가 삭제되면 첫 번째 이미지로 변경
    if (character.selectedImage === imageId) {
      updates.selectedImage = newImages[0] || undefined;
    }
    onUpdate(updates);
  };

  const handleSave = () => {
    onUpdate({
      name: form.name,
      appearance: form.appearance,
      defaultOutfit: form.defaultOutfit || undefined,
    });
    setEditing(false);
  };

  const selectedImageSrc = character.selectedImage ? getImageSrc(character.selectedImage) : '';

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* 헤더 */}
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-4">
          {selectedImageSrc ? (
            <img
              src={selectedImageSrc}
              alt={character.name}
              className="w-16 h-16 rounded-full object-cover border-2 border-blue-500"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xl">
              {character.name[0]}
            </div>
          )}
          <div>
            <h3 className="font-semibold text-gray-800 text-lg">{character.name}</h3>
            <p className="text-sm text-gray-500">
              {character.appearance.age} {character.appearance.gender}
              {character.referenceImages.length > 0 &&
                ` · 이미지 ${character.referenceImages.length}개`}
            </p>
          </div>
        </div>
        <button
          onClick={onGenerate}
          disabled={isGenerating || character.referenceImages.length >= 8}
          className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600 disabled:bg-gray-300 transition"
        >
          {isGenerating
            ? generatingProgress
              ? `생성 중 (${generatingProgress.current}/${generatingProgress.total})`
              : '생성 중...'
            : character.referenceImages.length >= 8
              ? '최대 8개'
              : 'AI 이미지 생성'}
        </button>
      </div>

      {/* 이미지 갤러리 - 항상 표시 */}
      <div className="p-4 space-y-4">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-700">
              참조 이미지 ({character.referenceImages.length}/8)
              {character.selectedImage && <span className="text-blue-500 text-sm ml-2">· 클릭하여 대표 이미지 선택</span>}
            </h4>
          </div>

          {character.referenceImages.length === 0 ? (
            <div className="flex items-center justify-center h-32 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <div className="text-center text-gray-400">
                <p className="mb-2">아직 이미지가 없습니다</p>
                <p className="text-sm">AI 이미지 생성 버튼을 클릭하거나 직접 업로드하세요</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-4">
              {character.referenceImages.map((imageId, index) => {
                const imageSrc = getImageSrc(imageId);
                const isSelected = character.selectedImage === imageId;
                return (
                  <div
                    key={imageId}
                    onClick={() => onSelectImage(imageId)}
                    className={`relative group cursor-pointer rounded-lg overflow-hidden border-4 transition ${
                      isSelected ? 'border-blue-500 shadow-lg' : 'border-transparent hover:border-gray-300'
                    }`}
                  >
                    {imageSrc ? (
                      <img
                        src={imageSrc}
                        alt={`참조 ${index + 1}`}
                        className="w-full aspect-square object-cover"
                      />
                    ) : (
                      <div className="w-full aspect-square bg-gray-100 flex items-center justify-center">
                        <span className="text-gray-400 text-sm">로딩...</span>
                      </div>
                    )}
                    {isSelected && (
                      <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded">
                        선택됨
                      </div>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveImage(index);
                      }}
                      className="absolute top-2 left-2 w-6 h-6 bg-red-500 text-white rounded-full text-sm opacity-0 group-hover:opacity-100 transition"
                    >
                      ×
                    </button>
                    <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                      #{index + 1}
                    </div>
                  </div>
                );
              })}

              {character.referenceImages.length < 8 && (
                <label className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition">
                  <span className="text-gray-400 text-3xl mb-1">+</span>
                  <span className="text-xs text-gray-400">직접 업로드</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </label>
              )}
            </div>
          )}
        </div>

        {/* 외모 정보 */}
        {editing ? (
          <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700">이름</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">나이</label>
                <input
                  type="text"
                  value={form.appearance.age || ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      appearance: { ...form.appearance, age: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">성별</label>
                <input
                  type="text"
                  value={form.appearance.gender || ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      appearance: { ...form.appearance, gender: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">머리</label>
                <input
                  type="text"
                  value={form.appearance.hair || ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      appearance: { ...form.appearance, hair: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">얼굴</label>
                <input
                  type="text"
                  value={form.appearance.face || ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      appearance: { ...form.appearance, face: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">기본 의상</label>
              <input
                type="text"
                value={form.defaultOutfit}
                onChange={(e) => setForm({ ...form, defaultOutfit: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                저장
              </button>
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-700">외모 정보</h4>
              <button
                onClick={() => setEditing(true)}
                className="text-sm text-blue-500 hover:underline"
              >
                수정
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {character.appearance.age && (
                <p><span className="text-gray-500">나이:</span> {character.appearance.age}</p>
              )}
              {character.appearance.gender && (
                <p><span className="text-gray-500">성별:</span> {character.appearance.gender}</p>
              )}
              {character.appearance.hair && (
                <p><span className="text-gray-500">머리:</span> {character.appearance.hair}</p>
              )}
              {character.appearance.face && (
                <p><span className="text-gray-500">얼굴:</span> {character.appearance.face}</p>
              )}
              {character.appearance.skinTone && (
                <p><span className="text-gray-500">피부:</span> {character.appearance.skinTone}</p>
              )}
              {character.defaultOutfit && (
                <p><span className="text-gray-500">의상:</span> {character.defaultOutfit}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
