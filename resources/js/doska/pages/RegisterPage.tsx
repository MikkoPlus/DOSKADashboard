import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '../api/auth';

export function RegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('New User');
  const [email, setEmail] = useState(`user_${Date.now()}@example.com`);
  const [password, setPassword] = useState('password');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <div className="mx-auto w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900/30 p-6">
      <h1 className="mb-1 text-xl font-semibold">Регистрация</h1>
      <p className="mb-6 text-sm text-zinc-400">После регистрации создаётся personal workspace.</p>

      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setLoading(true);
          setError(null);
          try {
            const res = await register({ name, email, password });
            localStorage.setItem('doska_token', res.token);
            navigate('/workspaces');
          } catch (err: any) {
            setError(err?.response?.data?.message ?? 'Не удалось зарегистрироваться');
          } finally {
            setLoading(false);
          }
        }}
      >
        <label className="block">
          <span className="mb-1 block text-sm text-zinc-300">Имя</span>
          <input
            className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm text-zinc-300">Email</span>
          <input
            className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm text-zinc-300">Пароль</span>
          <input
            className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="new-password"
          />
        </label>

        {error ? <div className="rounded border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">{error}</div> : null}

        <button
          className="w-full rounded bg-white px-3 py-2 font-medium text-zinc-950 hover:bg-zinc-200 disabled:opacity-60"
          disabled={loading}
        >
          {loading ? 'Создаём аккаунт…' : 'Зарегистрироваться'}
        </button>
      </form>

      <div className="mt-4 text-sm text-zinc-400">
        Уже есть аккаунт?{' '}
        <Link className="text-white underline underline-offset-4" to="/login">
          Вход
        </Link>
      </div>
    </div>
  );
}

