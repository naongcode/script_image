import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { addScript, updateScript, saveAnalysisResult } from '../lib/storage';
import { analyzeScript } from '../lib/gemini';
import type { Script, Character, Scene } from '../types';

export default function ScriptNew() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [rawContent, setRawContent] = useState('');
  const [genre, setGenre] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('제목을 입력해주세요.');
      return;
    }

    if (!rawContent.trim()) {
      setError('대본 내용을 입력해주세요.');
      return;
    }

    // 대본 생성
    const scriptId = uuidv4();
    const now = new Date().toISOString();
    const script: Script = {
      id: scriptId,
      title: title.trim(),
      rawContent: rawContent.trim(),
      genre: genre.trim() || undefined,
      status: 'analyzing',
      createdAt: now,
      updatedAt: now,
    };

    addScript(script);

    // AI 분석 시작
    setIsAnalyzing(true);

    try {
      const result = await analyzeScript(rawContent);

      // 캐릭터 생성
      const characters: Character[] = result.characters.map((c) => ({
        id: uuidv4(),
        scriptId,
        name: c.name,
        appearance: c.appearance,
        defaultOutfit: c.defaultOutfit,
        referenceImages: [],
        createdAt: now,
        updatedAt: now,
      }));

      // 캐릭터 이름 -> ID 매핑
      const charNameToId = new Map(characters.map((c) => [c.name, c.id]));

      // 장면 생성
      const scenes: Scene[] = result.scenes.map((s) => ({
        id: uuidv4(),
        scriptId,
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
      saveAnalysisResult(scriptId, characters, scenes);
      updateScript(scriptId, {
        status: 'ready',
        styleGuide: result.styleGuide,
      });

      navigate(`/scripts/${scriptId}`);
    } catch (err) {
      console.error('분석 실패:', err);
      setError(err instanceof Error ? err.message : '분석 중 오류가 발생했습니다.');
      updateScript(scriptId, { status: 'draft' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">새 대본</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-lg">{error}</div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            제목 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="대본 제목"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isAnalyzing}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            장르 (선택)
          </label>
          <select
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isAnalyzing}
          >
            <option value="">선택안함</option>
            <option value="드라마">드라마</option>
            <option value="로맨스">로맨스</option>
            <option value="코미디">코미디</option>
            <option value="액션">액션</option>
            <option value="스릴러">스릴러</option>
            <option value="판타지">판타지</option>
            <option value="SF">SF</option>
            <option value="애니메이션">애니메이션</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            대본 내용 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={rawContent}
            onChange={(e) => setRawContent(e.target.value)}
            placeholder="대본 내용을 입력하세요. 장면 설명, 대사 등을 포함해주세요."
            rows={15}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            disabled={isAnalyzing}
          />
          <p className="text-sm text-gray-500 mt-1">
            입력된 대본을 AI가 분석하여 캐릭터와 장면을 자동으로 추출합니다.
          </p>
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={isAnalyzing}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:bg-blue-300"
          >
            {isAnalyzing ? '분석 중...' : '대본 분석 시작'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            disabled={isAnalyzing}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            취소
          </button>
        </div>

        {isAnalyzing && (
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-blue-700">
              AI가 대본을 분석하고 있습니다. 잠시만 기다려주세요...
            </p>
          </div>
        )}
      </form>
    </div>
  );
}
