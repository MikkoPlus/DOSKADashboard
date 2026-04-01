import { api } from './client';

export type Board = {
  id: string;
  workspace_id: string;
  name: string;
  position: number;
  is_archived: boolean;
};

export async function listBoardsByWorkspace(workspaceId: string) {
  const { data } = await api.get<Board[]>(`/workspaces/${workspaceId}/boards`, {
    // важно для middleware current.workspace: он ищет route param workspace
  });
  return data;
}

export async function createBoard(payload: { workspace_id: string; name: string }) {
  const { data } = await api.post<Board>('/boards', payload);
  return data;
}

export async function archiveBoard(boardId: string) {
  const { data } = await api.delete<{ message: string }>(`/boards/${boardId}`);
  return data;
}

