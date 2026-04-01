import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { createBoard, listBoardsByWorkspace, type Board } from '../api/boards';

export function BoardsPage() {
  const navigate = useNavigate();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [items, setItems] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  const wsId = useMemo(() => workspaceId ?? '', [workspaceId]);

  useEffect(() => {
    const token = localStorage.getItem('doska_token');
    if (!token) {
      navigate('/login');
      return;
    }
    if (!wsId) return;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        setItems(await listBoardsByWorkspace(wsId));
      } catch (err: any) {
        setError(err?.response?.data?.message ?? 'Не удалось загрузить доски');
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate, wsId]);

  if (!wsId) return <div className="text-zinc-300">Workspace не указан.</div>;
  if (loading) return <div className="text-zinc-300">Загрузка…</div>;
  if (error) return <div className="rounded border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">{error}</div>;

  return (
    <div>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <div className="text-xs text-zinc-500">Workspace</div>
          <h1 className="text-2xl font-semibold">Доски</h1>
        </div>
        <Link className="text-sm text-zinc-300 underline underline-offset-4 hover:text-white" to="/workspaces">
          ← Workspaces
        </Link>
      </div>

      <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) return;

            setCreating(true);
            setError(null);
            try {
              const board = await createBoard({ workspace_id: wsId, name: name.trim() });
              setItems((prev) => [board, ...prev]);
              setName('');
            } catch (err: any) {
              setError(err?.response?.data?.message ?? 'Не удалось создать доску');
            } finally {
              setCreating(false);
            }
          }}
        >
          <label className="block flex-1">
            <span className="mb-1 block text-sm text-zinc-300">Новая доска</span>
            <input
              className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Product"
            />
          </label>
          <button
            className="rounded bg-white px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-zinc-200 disabled:opacity-60"
            disabled={creating}
            type="submit"
          >
            {creating ? 'Создаём…' : 'Создать'}
          </button>
        </form>
        <div className="mt-2 text-xs text-zinc-500">API: `POST /api/v1/boards`</div>
      </div>

      {items.length === 0 ? (
        <div className="rounded border border-zinc-800 bg-zinc-900/30 p-6 text-zinc-300">Нет досок.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((b) => (
            <div key={b.id} className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
              <div className="text-lg font-medium">{b.name}</div>
              <div className="mt-1 text-xs text-zinc-500">{b.id}</div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="text-sm text-zinc-400">Открой доску, чтобы управлять колонками и задачами.</div>
                <Link
                  className="rounded bg-zinc-800 px-3 py-1.5 text-xs text-zinc-100 hover:bg-zinc-700"
                  to={`/workspaces/${wsId}/boards/${b.id}`}
                >
                  Открыть доску
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

