import { useState, useEffect } from 'react';
import { useParams, Link, Routes, Route, useLocation } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { getScript, getCharactersByScript, getScenesByScript, updateScript, saveAnalysisResult } from '../lib/storage';
import { analyzeScript } from '../lib/gemini';
import type { Script, Character, Scene } from '../types';
import Characters from './Characters';
import Scenes from './Scenes';
import Generate from './Generate';

export default function ScriptDetail() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const [script, setScript] = useState<Script | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);

  const loadData = () => {
    if (id) {
      const s = getScript(id);
      if (s) {
        setScript(s);
        setCharacters(getCharactersByScript(id));
        setScenes(getScenesByScript(id));
      }
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  if (!script) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">대본을 찾을 수 없습니다.</p>
        <Link to="/" className="text-blue-500 hover:underline">
          홈으로 돌아가기
        </Link>
      </div>
    );
  }

  const tabs = [
    { path: `/scripts/${id}`, label: '정보', exact: true },
    { path: `/scripts/${id}/characters`, label: `캐릭터 (${characters.length})` },
    { path: `/scripts/${id}/scenes`, label: `장면 (${scenes.length})` },
    { path: `/scripts/${id}/generate`, label: '이미지 생성' },
  ];

  const isActive = (path: string, exact?: boolean) => {
    if (exact) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div>
      {/* 헤더 */}
      <div className="mb-6">
        <Link to="/" className="text-sm text-gray-500 hover:text-gray-700">
          ← 목록으로
        </Link>
        <h1 className="text-2xl font-bold text-gray-800 mt-2">{script.title}</h1>
        {script.genre && (
          <p className="text-sm text-gray-500">{script.genre}</p>
        )}
      </div>

      {/* 탭 네비게이션 */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-4">
          {tabs.map((tab) => (
            <Link
              key={tab.path}
              to={tab.path}
              className={`pb-3 px-1 border-b-2 transition ${
                isActive(tab.path, tab.exact)
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* 탭 콘텐츠 */}
      <Routes>
        <Route
          index
          element={<ScriptInfo script={script} characters={characters} scenes={scenes} onReanalyze={loadData} />}
        />
        <Route
          path="characters"
          element={<Characters scriptId={id!} onUpdate={loadData} />}
        />
        <Route
          path="scenes"
          element={<Scenes scriptId={id!} onUpdate={loadData} />}
        />
        <Route
          path="generate"
          element={<Generate scriptId={id!} onUpdate={loadData} />}
        />
      </Routes>
    </div>
  );
}

// 대본 정보 탭
function ScriptInfo({
  script,
  characters,
  scenes,
  onReanalyze,
}: {
  script: Script;
  characters: Character[];
  scenes: Scene[];
  onReanalyze: () => void;
}) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState('');

  const handleReanalyze = async () => {
    if (!confirm('기존 캐릭터와 장면 정보가 삭제됩니다. 계속하시겠습니까?')) {
      return;
    }

    setIsAnalyzing(true);
    setError('');

    try {
      const result = await analyzeScript(script.rawContent);
      const now = new Date().toISOString();

      // 캐릭터 생성
      const newCharacters: Character[] = result.characters.map((c) => ({
        id: uuidv4(),
        scriptId: script.id,
        name: c.name,
        appearance: c.appearance,
        defaultOutfit: c.defaultOutfit,
        referenceImages: [],
        createdAt: now,
        updatedAt: now,
      }));

      // 캐릭터 이름 -> ID 매핑
      const charNameToId = new Map(newCharacters.map((c) => [c.name, c.id]));

      // 장면 생성
      const newScenes: Scene[] = result.scenes.map((s) => ({
        id: uuidv4(),
        scriptId: script.id,
        sceneNumber: s.sceneNumber,
        title: s.title,
        location: s.location,
        timeOfDay: s.timeOfDay,
        originalText: s.originalText,
        visualDescription: s.visualDescription,
        characterIds: s.characterNames
          .map((name) => charNameToId.get(name))
          .filter((id): id is string => !!id),
        generatedImages: [],
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      }));

      // 저장
      saveAnalysisResult(script.id, newCharacters, newScenes);
      updateScript(script.id, {
        status: 'ready',
        styleGuide: result.styleGuide,
      });

      onReanalyze();
    } catch (err) {
      console.error('분석 실패:', err);
      setError(err instanceof Error ? err.message : '분석 중 오류가 발생했습니다.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 에러 메시지 */}
      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg">{error}</div>
      )}

      {/* 분석 버튼 */}
      <div className="flex gap-4">
        <button
          onClick={handleReanalyze}
          disabled={isAnalyzing}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:bg-blue-300"
        >
          {isAnalyzing ? '분석 중...' : '대본 재분석'}
        </button>
        {script.status === 'draft' && (
          <span className="text-yellow-600 self-center">⚠️ 아직 분석되지 않았습니다</span>
        )}
      </div>

      {isAnalyzing && (
        <div className="p-4 bg-blue-50 rounded-lg">
          <p className="text-blue-700">AI가 대본을 분석하고 있습니다. 잠시만 기다려주세요...</p>
        </div>
      )}

      {/* 요약 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">캐릭터</p>
          <p className="text-2xl font-bold text-gray-800">{characters.length}명</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">장면</p>
          <p className="text-2xl font-bold text-gray-800">{scenes.length}개</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">생성된 이미지</p>
          <p className="text-2xl font-bold text-gray-800">
            {scenes.filter((s) => s.status === 'completed').length}개
          </p>
        </div>
      </div>

      {/* 스타일 가이드 */}
      {script.styleGuide && (
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold text-gray-800 mb-2">스타일 가이드</h3>
          <p className="text-gray-600">{script.styleGuide}</p>
        </div>
      )}

      {/* 대본 원문 */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="font-semibold text-gray-800 mb-2">대본 원문</h3>
        <pre className="text-sm text-gray-600 whitespace-pre-wrap font-mono bg-gray-50 p-4 rounded max-h-96 overflow-auto">
          {script.rawContent}
        </pre>
      </div>
    </div>
  );
}
