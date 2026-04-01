import { api } from './client';

export type Workspace = {
  id: string;
  owner_id: string;
  name: string;
  type: 'personal' | 'team';
};

export async function listWorkspaces() {
  const { data } = await api.get<Workspace[]>('/workspaces');
  return data;
}

