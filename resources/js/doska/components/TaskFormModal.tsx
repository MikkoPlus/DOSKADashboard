import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from './Modal';
import type { Task, TaskChecklistItem, TaskPriority } from '../api/tasks';
import { createTask, deleteTask, updateTask } from '../api/tasks';
import { dueAtToInput, inputToDueAt } from '../lib/dates';

export type TaskFormMode =
  | { type: 'create'; columnId: string; columnName: string }
  | { type: 'edit'; task: Task };

type Props = {
  open: boolean;
  mode: TaskFormMode | null;
  boardId: string;
  onClose: () => void;
  onSaved: (task: Task) => void;
  onDeleted: (taskId: string) => void;
  onError: (message: string) => void;
};

function newClientKey() {
  return `c_${Math.random().toString(36).slice(2, 11)}`;
}

type Row = { key: string; id?: string; title: string; done: boolean };
type FieldErrors = {
  title?: string;
  description?: string;
  priority?: string;
  due_at?: string;
  checklist?: string;
  general?: string;
};

function rowsFromChecklist(items: TaskChecklistItem[] | null | undefined): Row[] {
  if (!items?.length) return [];
  return items.map((it) => ({
    key: it.id || newClientKey(),
    id: it.id,
    title: it.title,
    done: it.done,
  }));
}

function rowsToPayload(rows: Row[]): { id?: string; title: string; done: boolean }[] {
  return rows
    .map((r) => {
      const title = r.title.trim();
      if (!title) return null;
      const o: { id?: string; title: string; done: boolean } = { title, done: r.done };
      if (r.id) o.id = r.id;
      return o;
    })
    .filter((x): x is NonNullable<typeof x> => x != null);
}

const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Низкая' },
  { value: 'normal', label: 'Обычная' },
  { value: 'high', label: 'Высокая' },
  { value: 'urgent', label: 'Срочно' },
];

export function TaskFormModal({ open, mode, boardId, onClose, onSaved, onDeleted, onError }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [dueInput, setDueInput] = useState('');
  const [checklistRows, setChecklistRows] = useState<Row[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const todayStr = useMemo(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }, []);

  const isEdit = mode?.type === 'edit';
  const task = mode?.type === 'edit' ? mode.task : null;

  useEffect(() => {
    if (!open || !mode) return;
    if (mode.type === 'create') {
      setTitle('');
      setDescription('');
      setPriority('normal');
      setDueInput('');
      setChecklistRows([]);
      setIsCompleted(false);
      setFieldErrors({});
      return;
    }
    const t = mode.task;
    setTitle(t.title);
    setDescription(t.description ?? '');
    setPriority((t.priority as TaskPriority) || 'normal');
    setDueInput(dueAtToInput(t.due_at));
    setChecklistRows(rowsFromChecklist(t.checklist));
    setIsCompleted(t.is_completed);
    setFieldErrors({});
  }, [open, mode]);

  const modalTitle = useMemo(() => {
    if (!mode) return '';
    if (mode.type === 'create') return `Новая задача — «${mode.columnName}»`;
    return 'Редактирование задачи';
  }, [mode]);

  const addChecklistRow = () => {
    setChecklistRows((prev) => [...prev, { key: newClientKey(), title: '', done: false }]);
  };

  const removeRow = (key: string) => {
    setChecklistRows((prev) => prev.filter((r) => r.key !== key));
  };

  const updateRow = (key: string, patch: Partial<Pick<Row, 'title' | 'done'>>) => {
    setChecklistRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    if (!mode || !title.trim()) return;
    if (dueInput && dueInput < todayStr) {
      setFieldErrors({ due_at: 'Срок не может быть меньше текущей даты' });
      return;
    }
    const due = inputToDueAt(dueInput);
    const checklistPayload = rowsToPayload(checklistRows);
    setSaving(true);
    try {
      if (mode.type === 'create') {
        const created = await createTask({
          board_id: boardId,
          column_id: mode.columnId,
          title: title.trim(),
          description: description.trim() || null,
          priority,
          due_at: due,
          checklist: checklistPayload.length ? checklistPayload : undefined,
        });
        onClose();
        onSaved(created);
      } else {
        const updated = await updateTask(mode.task.id, {
          title: title.trim(),
          description: description.trim() || null,
          priority,
          due_at: due,
          checklist: checklistPayload,
          is_completed: isCompleted,
        });
        onSaved(updated);
        onClose();
      }
    } catch (err: unknown) {
      const response = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }).response
        : undefined;
      const serverErrors = response?.data?.errors ?? {};
      if (Object.keys(serverErrors).length > 0) {
        setFieldErrors({
          title: serverErrors.title?.[0],
          description: serverErrors.description?.[0],
          priority: serverErrors.priority?.[0],
          due_at: serverErrors.due_at?.[0],
          checklist: serverErrors.checklist?.[0] ?? serverErrors['checklist.0.title']?.[0],
          general: response?.data?.message,
        });
      } else {
        onError(response?.data?.message ?? 'Не удалось сохранить задачу');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!task || !window.confirm('Удалить задачу? Это действие нельзя отменить.')) return;
    setDeleting(true);
    try {
      await deleteTask(task.id);
      onDeleted(task.id);
      onClose();
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : null;
      onError(msg ?? 'Не удалось удалить задачу');
    } finally {
      setDeleting(false);
    }
  };

  if (!mode) return null;

  return (
    <Modal open={open} onClose={onClose} title={modalTitle}>
      <form className="max-h-[min(85vh,640px)] space-y-5 overflow-y-auto pr-1" onSubmit={handleSubmit}>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500">Заголовок</span>
          <input
            autoFocus={!isEdit}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Кратко, что сделать"
            required
          />
          {fieldErrors.title ? <p className="mt-1 text-xs text-red-300">{fieldErrors.title}</p> : null}
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500">Описание</span>
          <textarea
            className="min-h-[108px] w-full resize-y rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Детали, контекст, ссылки…"
          />
          {fieldErrors.description ? <p className="mt-1 text-xs text-red-300">{fieldErrors.description}</p> : null}
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500">Важность</span>
            <select
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 focus:border-zinc-500 focus:outline-none"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
            >
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            {fieldErrors.priority ? <p className="mt-1 text-xs text-red-300">{fieldErrors.priority}</p> : null}
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500">Срок</span>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">📅</span>
              <input
                type="date"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 pl-9 pr-3 py-2 text-zinc-100 scheme-dark focus:border-zinc-500 focus:outline-none"
                value={dueInput}
                min={todayStr}
                onChange={(e) => setDueInput(e.target.value)}
              />
            </div>
            {fieldErrors.due_at ? <p className="mt-1 text-xs text-red-300">{fieldErrors.due_at}</p> : null}
          </label>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Подзадачи</span>
            <button
              type="button"
              className="rounded-md border border-zinc-600 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
              onClick={addChecklistRow}
            >
              + Пункт
            </button>
          </div>
          <div className="space-y-2">
            {checklistRows.length === 0 ? (
              <p className="text-xs text-zinc-600">Нет подзадач — добавьте шаги к выполнению.</p>
            ) : null}
            {checklistRows.map((row) => (
              <div key={row.key} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-2.5 shrink-0 rounded border-zinc-600"
                  checked={row.done}
                  onChange={(e) => updateRow(row.key, { done: e.target.checked })}
                />
                <input
                  type="text"
                  className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none"
                  value={row.title}
                  onChange={(e) => updateRow(row.key, { title: e.target.value })}
                  placeholder="Текст подзадачи"
                />
                <button
                  type="button"
                  className="shrink-0 rounded p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                  onClick={() => removeRow(row.key)}
                  aria-label="Удалить пункт"
                >
                  ×
                </button>
              </div>
            ))}
            {fieldErrors.checklist ? <p className="text-xs text-red-300">{fieldErrors.checklist}</p> : null}
          </div>
        </div>
        {fieldErrors.general ? <p className="text-xs text-red-300">{fieldErrors.general}</p> : null}

        {isEdit ? (
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
            <input type="checkbox" className="rounded border-zinc-600" checked={isCompleted} onChange={(e) => setIsCompleted(e.target.checked)} />
            Задача выполнена
          </label>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800 pt-4">
          <div>
            {isEdit ? (
              <button
                type="button"
                className="rounded-lg px-3 py-2 text-sm text-red-400 hover:bg-red-950/50 disabled:opacity-50"
                disabled={deleting || saving}
                onClick={handleDelete}
              >
                {deleting ? 'Удаление…' : 'Удалить задачу'}
              </button>
            ) : (
              <span />
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" className="rounded-lg px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="btn-accent" disabled={saving}>
              {saving ? 'Сохранение…' : isEdit ? 'Сохранить' : 'Создать'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
