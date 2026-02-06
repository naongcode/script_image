import { Link } from 'react-router-dom';
import { loadScripts, deleteScript } from '../lib/storage';
import { useState, useEffect } from 'react';
import type { Script } from '../types';

export default function Home() {
  const [scripts, setScripts] = useState<Script[]>([]);

  useEffect(() => {
    setScripts(loadScripts());
  }, []);

  const handleDelete = (id: string) => {
    if (confirm('정말 삭제하시겠습니까? 관련된 캐릭터와 장면도 모두 삭제됩니다.')) {
      deleteScript(id);
      setScripts(loadScripts());
    }
  };

  const getStatusBadge = (status: Script['status']) => {
    const badges = {
      draft: { text: '초안', color: 'bg-gray-200 text-gray-700' },
      analyzing: { text: '분석중', color: 'bg-yellow-200 text-yellow-700' },
      ready: { text: '준비됨', color: 'bg-blue-200 text-blue-700' },
      generating: { text: '생성중', color: 'bg-purple-200 text-purple-700' },
      completed: { text: '완료', color: 'bg-green-200 text-green-700' },
    };
    const badge = badges[status];
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${badge.color}`}>
        {badge.text}
      </span>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">대본 목록</h1>
        <Link
          to="/scripts/new"
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
        >
          + 새 대본
        </Link>
      </div>

      {scripts.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500 mb-4">아직 대본이 없습니다.</p>
          <Link
            to="/scripts/new"
            className="text-blue-500 hover:text-blue-600"
          >
            새 대본 만들기
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {scripts.map((script) => (
            <div
              key={script.id}
              className="bg-white rounded-lg shadow p-4 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Link
                      to={`/scripts/${script.id}`}
                      className="text-lg font-semibold text-gray-800 hover:text-blue-500"
                    >
                      {script.title}
                    </Link>
                    {getStatusBadge(script.status)}
                  </div>
                  <p className="text-sm text-gray-500">
                    {script.genre && `${script.genre} · `}
                    {new Date(script.createdAt).toLocaleDateString('ko-KR')}
                  </p>
                  <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                    {script.rawContent.slice(0, 100)}...
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link
                    to={`/scripts/${script.id}`}
                    className="px-3 py-1 text-sm text-blue-500 hover:bg-blue-50 rounded"
                  >
                    열기
                  </Link>
                  <button
                    onClick={() => handleDelete(script.id)}
                    className="px-3 py-1 text-sm text-red-500 hover:bg-red-50 rounded"
                  >
                    삭제
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
