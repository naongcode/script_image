import { Outlet, Link } from 'react-router-dom';

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-gray-800">
            Script Image Generator
          </Link>
          <nav className="flex gap-4">
            <Link
              to="/"
              className="text-gray-600 hover:text-gray-900 transition"
            >
              홈
            </Link>
            <Link
              to="/scripts/new"
              className="text-gray-600 hover:text-gray-900 transition"
            >
              새 대본
            </Link>
          </nav>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
