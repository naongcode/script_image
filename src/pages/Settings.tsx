import { useState, useEffect } from 'react';
import { loadApiKey, saveApiKey } from '../lib/storage';
import { initGemini } from '../lib/gemini';

export default function Settings() {
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const key = loadApiKey();
    if (key) {
      setApiKey(key);
    }
  }, []);

  const handleSave = () => {
    if (!apiKey.trim()) {
      alert('API 키를 입력해주세요.');
      return;
    }

    saveApiKey(apiKey.trim());
    initGemini(apiKey.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">설정</h1>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          Google Gemini API 키
        </h2>

        <p className="text-sm text-gray-600 mb-4">
          이미지 생성과 대본 분석을 위해 Google Gemini API 키가 필요합니다.
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline ml-1"
          >
            API 키 발급받기
          </a>
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIza..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
          >
            저장
          </button>

          {saved && (
            <p className="text-green-500 text-sm">저장되었습니다!</p>
          )}
        </div>

        <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
          <h3 className="text-sm font-semibold text-yellow-800 mb-2">
            주의사항
          </h3>
          <ul className="text-sm text-yellow-700 list-disc list-inside space-y-1">
            <li>API 키는 브라우저의 localStorage에 저장됩니다.</li>
            <li>개인 사용 목적으로만 사용해주세요.</li>
            <li>공용 컴퓨터에서는 사용을 권장하지 않습니다.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
