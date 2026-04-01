import { api } from './client';

export type AuthResponse = {
  user: { id: string; name: string; email: string };
  token: string;
  workspace?: { id: string; name: string; type: 'personal' | 'team' };
};

export async function register(payload: { name: string; email: string; password: string }) {
  const { data } = await api.post<AuthResponse>('/auth/register', payload);
  return data;
}

export async function login(payload: { email: string; password: string }) {
  const { data } = await api.post<AuthResponse>('/auth/login', payload);
  return data;
}

export async function logout() {
  await api.post('/auth/logout');
}

