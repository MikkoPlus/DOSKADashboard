import { api } from './client';

export type Column = {
  id: string;
  workspace_id: string;
  board_id: string;
  name: string;
  position: number;
};

export async function listColumnsByBoard(boardId: string) {
  const { data } = await api.get<Column[]>(`/boards/${boardId}/columns`);
  return data;
}

export async function createColumn(payload: { board_id: string; name: string }) {
  const { data } = await api.post<Column>('/columns', payload);
  return data;
}

export async function updateColumn(id: string, payload: Partial<Pick<Column, 'name' | 'position'>>) {
  const { data } = await api.patch<Column>(`/columns/${id}`, payload);
  return data;
}

export async function reorderColumns(boardId: string, columnIds: string[]) {
  const { data } = await api.patch<Column[]>(`/boards/${boardId}/columns/reorder`, {
    column_ids: columnIds,
  });
  return data;
}

export async function deleteColumn(id: string) {
  await api.delete(`/columns/${id}`);
}

