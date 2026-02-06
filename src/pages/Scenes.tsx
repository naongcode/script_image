import { useState, useEffect } from 'react';
import { getScenesByScript, getCharactersByScript, updateScene } from '../lib/storage';
import type { Scene, Character } from '../types';

interface Props {
  scriptId: string;
  onUpdate: () => void;
}

export default function Scenes({ scriptId, onUpdate }: Props) {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    setScenes(getScenesByScript(scriptId));
    setCharacters(getCharactersByScript(scriptId));
  }, [scriptId]);

  const handleUpdateScene = (id: string, updates: Partial<Scene>) => {
    updateScene(id, updates);
    setScenes(getScenesByScript(scriptId));
    onUpdate();
  };

  const getCharacterNames = (characterIds: string[]) => {
    return characterIds
      .map((id) => characters.find((c) => c.id === id)?.name)
      .filter(Boolean)
      .join(', ');
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-800">장면 목록</h2>
      <p className="text-sm text-gray-500">
        각 장면의 프롬프트를 확인하고 수정할 수 있습니다. 이미지 생성 탭에서 이미지를 생성하세요.
      </p>

      {scenes.length === 0 ? (
        <div className="text-center py-8 bg-white rounded-lg shadow">
          <p className="text-gray-500">분석된 장면이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {scenes.map((scene) => (
            <SceneCard
              key={scene.id}
              scene={scene}
              characterNames={getCharacterNames(scene.characterIds)}
              isExpanded={selectedId === scene.id}
              onToggle={() => setSelectedId(selectedId === scene.id ? null : scene.id)}
              onUpdate={(updates) => handleUpdateScene(scene.id, updates)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SceneCard({
  scene,
  characterNames,
  isExpanded,
  onToggle,
  onUpdate,
}: {
  scene: Scene;
  characterNames: string;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (updates: Partial<Scene>) => void;
}) {
  const [editingPrompt, setEditingPrompt] = useState(false);
  const [promptText, setPromptText] = useState(
    scene.userEditedPrompt || scene.generatedPrompt || scene.visualDescription || ''
  );

  const getStatusBadge = (status: Scene['status']) => {
    const badges = {
      pending: { text: '대기중', color: 'bg-gray-200 text-gray-700' },
      generating: { text: '생성중', color: 'bg-yellow-200 text-yellow-700' },
      completed: { text: '완료', color: 'bg-green-200 text-green-700' },
      failed: { text: '실패', color: 'bg-red-200 text-red-700' },
    };
    const badge = badges[status];
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${badge.color}`}>
        {badge.text}
      </span>
    );
  };

  const handleSavePrompt = () => {
    onUpdate({ userEditedPrompt: promptText });
    setEditingPrompt(false);
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* 헤더 */}
      <div
        className="p-4 cursor-pointer hover:bg-gray-50 flex items-center justify-between"
        onClick={onToggle}
      >
        <div className="flex items-center gap-4">
          {scene.generatedImages[0] ? (
            <img
              src={scene.generatedImages[0]}
              alt={`장면 ${scene.sceneNumber}`}
              className="w-16 h-16 rounded-lg object-cover"
            />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center text-gray-400">
              #{scene.sceneNumber}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-800">
                장면 {scene.sceneNumber}
                {scene.title && `: ${scene.title}`}
              </h3>
              {getStatusBadge(scene.status)}
            </div>
            <p className="text-sm text-gray-500">
              {scene.location && `${scene.location}`}
              {scene.timeOfDay && ` · ${scene.timeOfDay}`}
              {characterNames && ` · ${characterNames}`}
            </p>
          </div>
        </div>
        <span className="text-gray-400">{isExpanded ? '▼' : '▶'}</span>
      </div>

      {/* 상세 */}
      {isExpanded && (
        <div className="border-t p-4 space-y-4">
          {/* 원본 대본 */}
          <div>
            <h4 className="font-medium text-gray-700 mb-2">원본 대본</h4>
            <pre className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg max-h-40 overflow-auto">
              {scene.originalText}
            </pre>
          </div>

          {/* 시각적 묘사 */}
          {scene.visualDescription && (
            <div>
              <h4 className="font-medium text-gray-700 mb-2">AI 시각적 묘사</h4>
              <p className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
                {scene.visualDescription}
              </p>
            </div>
          )}

          {/* 이미지 생성 프롬프트 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-700">이미지 생성 프롬프트</h4>
              {!editingPrompt && (
                <button
                  onClick={() => setEditingPrompt(true)}
                  className="text-sm text-blue-500 hover:underline"
                >
                  수정
                </button>
              )}
            </div>
            {editingPrompt ? (
              <div className="space-y-2">
                <textarea
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSavePrompt}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600"
                  >
                    저장
                  </button>
                  <button
                    onClick={() => {
                      setPromptText(scene.userEditedPrompt || scene.generatedPrompt || scene.visualDescription || '');
                      setEditingPrompt(false);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                  >
                    취소
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                {scene.userEditedPrompt || scene.generatedPrompt || scene.visualDescription || '프롬프트 없음'}
              </p>
            )}
          </div>

          {/* 생성된 이미지 */}
          {scene.generatedImages.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-700 mb-2">
                생성된 이미지 ({scene.generatedImages.length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {scene.generatedImages.map((img, index) => (
                  <a
                    key={index}
                    href={img}
                    download={`scene_${scene.sceneNumber}_${index + 1}.png`}
                    className="block"
                  >
                    <img
                      src={img}
                      alt={`생성 이미지 ${index + 1}`}
                      className="w-32 h-32 object-cover rounded-lg hover:opacity-80 transition"
                    />
                  </a>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                이미지를 클릭하면 다운로드됩니다.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
