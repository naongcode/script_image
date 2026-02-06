import { useState, useEffect, useRef } from 'react';
import { getCharactersByScript, updateCharacter } from '../lib/storage';
import type { Character } from '../types';

interface Props {
  scriptId: string;
  onUpdate: () => void;
}

export default function Characters({ scriptId, onUpdate }: Props) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    setCharacters(getCharactersByScript(scriptId));
  }, [scriptId]);

  const handleUpdateCharacter = (id: string, updates: Partial<Character>) => {
    updateCharacter(id, updates);
    setCharacters(getCharactersByScript(scriptId));
    onUpdate();
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-800">캐릭터 목록</h2>
      <p className="text-sm text-gray-500">
        캐릭터 정보를 수정하고 참조 이미지를 업로드하세요. 참조 이미지는 이미지 생성 시 일관성 유지에 사용됩니다.
      </p>

      {characters.length === 0 ? (
        <div className="text-center py-8 bg-white rounded-lg shadow">
          <p className="text-gray-500">분석된 캐릭터가 없습니다.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {characters.map((char) => (
            <CharacterCard
              key={char.id}
              character={char}
              isExpanded={selectedId === char.id}
              onToggle={() => setSelectedId(selectedId === char.id ? null : char.id)}
              onUpdate={(updates) => handleUpdateCharacter(char.id, updates)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CharacterCard({
  character,
  isExpanded,
  onToggle,
  onUpdate,
}: {
  character: Character;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (updates: Partial<Character>) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: character.name,
    appearance: { ...character.appearance },
    defaultOutfit: character.defaultOutfit || '',
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const remainingSlots = 8 - character.referenceImages.length;
    const filesToProcess = Array.from(files).slice(0, remainingSlots);

    filesToProcess.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        onUpdate({
          referenceImages: [...character.referenceImages, base64],
        });
      };
      reader.readAsDataURL(file);
    });

    // 입력 초기화
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = (index: number) => {
    const newImages = character.referenceImages.filter((_, i) => i !== index);
    onUpdate({ referenceImages: newImages });
  };

  const handleSave = () => {
    onUpdate({
      name: form.name,
      appearance: form.appearance,
      defaultOutfit: form.defaultOutfit || undefined,
    });
    setEditing(false);
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* 헤더 */}
      <div
        className="p-4 cursor-pointer hover:bg-gray-50 flex items-center justify-between"
        onClick={onToggle}
      >
        <div className="flex items-center gap-4">
          {character.referenceImages[0] ? (
            <img
              src={character.referenceImages[0]}
              alt={character.name}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
              {character.name[0]}
            </div>
          )}
          <div>
            <h3 className="font-semibold text-gray-800">{character.name}</h3>
            <p className="text-sm text-gray-500">
              {character.appearance.age} {character.appearance.gender}
              {character.referenceImages.length > 0 &&
                ` · 참조 이미지 ${character.referenceImages.length}개`}
            </p>
          </div>
        </div>
        <span className="text-gray-400">{isExpanded ? '▼' : '▶'}</span>
      </div>

      {/* 상세 */}
      {isExpanded && (
        <div className="border-t p-4 space-y-4">
          {/* 참조 이미지 */}
          <div>
            <h4 className="font-medium text-gray-700 mb-2">
              참조 이미지 ({character.referenceImages.length}/8)
            </h4>
            <div className="flex flex-wrap gap-2">
              {character.referenceImages.map((img, index) => (
                <div key={index} className="relative group">
                  <img
                    src={img}
                    alt={`참조 ${index + 1}`}
                    className="w-24 h-24 object-cover rounded-lg"
                  />
                  <button
                    onClick={() => handleRemoveImage(index)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-sm opacity-0 group-hover:opacity-100 transition"
                  >
                    ×
                  </button>
                </div>
              ))}
              {character.referenceImages.length < 8 && (
                <label className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition">
                  <span className="text-gray-400 text-2xl">+</span>
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
            <p className="text-xs text-gray-500 mt-1">
              캐릭터의 참조 이미지를 업로드하세요. 이미지 생성 시 일관성 유지에 사용됩니다.
            </p>
          </div>

          {/* 외모 정보 */}
          {editing ? (
            <div className="space-y-3">
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
            <div>
              <h4 className="font-medium text-gray-700 mb-2">외모 정보</h4>
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
                {character.defaultOutfit && (
                  <p><span className="text-gray-500">의상:</span> {character.defaultOutfit}</p>
                )}
              </div>
              <button
                onClick={() => setEditing(true)}
                className="mt-3 text-sm text-blue-500 hover:underline"
              >
                수정하기
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
