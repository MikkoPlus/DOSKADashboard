import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listWorkspaces, type Workspace } from '../api/workspaces';

export function WorkspacesPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('doska_token');
    if (!token) {
      navigate('/login');
      return;
    }

    (async () => {
      setLoading(true);
      setError(null);
      try {
        setItems(await listWorkspaces());
      } catch (err: any) {
        setError(err?.response?.data?.message ?? 'Не удалось загрузить workspaces');
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  if (loading) return <div className="text-zinc-300">Загрузка…</div>;
  if (error) return <div className="rounded border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">{error}</div>;

  return (
    <div>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Workspaces</h1>
          <p className="mt-1 text-sm text-zinc-400">Выбери рабочее пространство.</p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded border border-zinc-800 bg-zinc-900/30 p-6 text-zinc-300">
          Пусто. Создай workspace через API `POST /api/v1/workspaces`.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((w) => (
            <div key={w.id} className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-medium">{w.name}</div>
                  <div className="mt-1 text-xs text-zinc-400">
                    {w.type} · {w.id}
                  </div>
                </div>
                <Link
                  className="rounded bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-700"
                  to={`/workspaces/${w.id}/boards`}
                >
                  Открыть
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

