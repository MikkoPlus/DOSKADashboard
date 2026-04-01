import { api } from './client';

export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export type TaskChecklistItem = {
  id: string;
  title: string;
  done: boolean;
};

export type Task = {
  id: string;
  workspace_id: string;
  board_id: string;
  column_id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  checklist: TaskChecklistItem[] | null;
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
  priority?: TaskPriority;
  due_at?: string | null;
  checklist?: { id?: string; title: string; done: boolean }[];
  assignee_id?: string | null;
}) {
  const { data } = await api.post<Task>('/tasks', payload);
  return data;
}

export async function updateTask(
  id: string,
  payload: Partial<{
    title: string;
    description: string | null;
    priority: TaskPriority;
    checklist: { id?: string; title: string; done: boolean }[];
    assignee_id: string | null;
    due_at: string | null;
    is_completed: boolean;
    column_id: string;
    position: number;
  }>,
) {
  const { data } = await api.patch<Task>(`/tasks/${id}`, payload);
  return data;
}

export async function deleteTask(id: string) {
  await api.delete(`/tasks/${id}`);
}
