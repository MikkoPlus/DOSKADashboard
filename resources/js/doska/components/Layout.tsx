import React from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { logout } from '../api/auth';

/** Страница канбан-доски — на всю ширину окна с полями по краям */
function useBoardCanvasLayout(): boolean {
  const { pathname } = useLocation();
  return /\/workspaces\/[^/]+\/boards\/[^/]+$/.test(pathname);
}

export function Layout() {
  const navigate = useNavigate();
  const token = localStorage.getItem('doska_token');
  const boardCanvas = useBoardCanvasLayout();
  const shellClass = boardCanvas
    ? 'mx-auto w-full max-w-none px-4 sm:px-6 lg:px-8'
    : 'mx-auto max-w-5xl px-4';

  return (
    <div className={boardCanvas ? 'flex min-h-screen flex-1 flex-col' : 'min-h-screen'}>
      <header className="shrink-0 border-b border-zinc-800">
        <div className={`flex items-center justify-between py-3 ${shellClass}`}>
          <div className="flex items-center gap-3">
            <Link to="/workspaces" className="font-semibold tracking-wide">
              DOSKA
            </Link>
            <span className="text-xs text-zinc-400">Dashboard</span>
          </div>

          <nav className="flex items-center gap-3 text-sm">
            {!token ? (
              <>
                <Link className="text-zinc-200 hover:text-white" to="/login">
                  Вход
                </Link>
                <Link className="btn-accent-sm inline-flex items-center no-underline" to="/register">
                  Регистрация
                </Link>
              </>
            ) : (
              <button
                className="rounded bg-zinc-800 px-3 py-1.5 text-zinc-100 hover:bg-zinc-700"
                onClick={async () => {
                  try {
                    await logout();
                  } finally {
                    localStorage.removeItem('doska_token');
                    navigate('/login');
                  }
                }}
              >
                Выйти
              </button>
            )}
          </nav>
        </div>
      </header>

      <main
        className={`py-6 sm:py-8 ${shellClass} ${boardCanvas ? 'flex min-h-0 flex-1 flex-col' : ''}`}
      >
        <Outlet />
      </main>
    </div>
  );
}

