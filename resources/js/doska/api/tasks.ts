import { api } from './client';

export type Task = {
  id: string;
  workspace_id: string;
  board_id: string;
  column_id: string;
  title: string;
  description: string | null;
  assignee_id: string | null;
  due_at: string | null;
  is_completed: boolean;
  position: number;
};

export async function listTasksByBoard(boardId: string) {
  const { data } = await api.get<Task[]>(`/boards/${boardId}/tasks`);
  return data;
}

export async function createTask(payload: {
  board_id: string;
  column_id: string;
  title: string;
  description?: string | null;
}) {
  const { data } = await api.post<Task>('/tasks', payload);
  return data;
}

export async function updateTask(id: string, payload: Partial<Pick<Task, 'title' | 'description' | 'is_completed' | 'column_id' | 'position'>>) {
  const { data } = await api.patch<Task>(`/tasks/${id}`, payload);
  return data;
}

export async function deleteTask(id: string) {
  await api.delete(`/tasks/${id}`);
}

