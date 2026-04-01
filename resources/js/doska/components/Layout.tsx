import React from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { logout } from '../api/auth';

export function Layout() {
  const navigate = useNavigate();
  const token = localStorage.getItem('doska_token');

  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-800">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
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
                <Link className="rounded bg-white px-3 py-1.5 text-zinc-950 hover:bg-zinc-200" to="/register">
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

      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}

