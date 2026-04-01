import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { listColumnsByBoard, type Column, createColumn, reorderColumns, updateColumn, deleteColumn } from '../api/columns';
import { listTasksByBoard, type Task, type TaskPriority, updateTask } from '../api/tasks';
import {
  DndContext,
  DragOverlay,
  type DragOverEvent,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, horizontalListSortingStrategy, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableColumn } from '../components/SortableColumn';
import { SortableTaskItem } from '../components/SortableTaskItem';
import { Modal } from '../components/Modal';
import { TaskFormModal, type TaskFormMode } from '../components/TaskFormModal';
import { formatDueDateRu } from '../lib/dates';

type ColumnWithTasks = Column & { tasks: Task[] };

function normalizeTaskFromApi(t: Task): Task {
  return {
    ...t,
    priority: t.priority ?? 'normal',
    checklist: Array.isArray(t.checklist) ? t.checklist : null,
  };
}

function priorityBadgeClass(p: TaskPriority): string {
  switch (p) {
    case 'urgent':
      return 'bg-red-900/60 text-red-200';
    case 'high':
      return 'bg-amber-900/50 text-amber-200';
    case 'low':
      return 'bg-zinc-800 text-zinc-400';
    default:
      return 'bg-zinc-800/80 text-zinc-300';
  }
}

function priorityLabel(p: TaskPriority): string {
  switch (p) {
    case 'urgent':
      return 'Срочно';
    case 'high':
      return 'Высокая';
    case 'low':
      return 'Низкая';
    default:
      return 'Обычная';
  }
}

function checklistProgress(task: Task): string | null {
  const list = task.checklist;
  if (!list?.length) return null;
  const done = list.filter((i) => i.done).length;
  return `${done}/${list.length}`;
}

function upsertTaskInColumns(prev: ColumnWithTasks[], task: Task): ColumnWithTasks[] {
  if (task.is_completed) {
    return prev.map((c) => ({ ...c, tasks: c.tasks.filter((t) => t.id !== task.id) }));
  }
  return prev.map((c) => {
    const without = c.tasks.filter((t) => t.id !== task.id);
    if (c.id !== task.column_id) {
      return { ...c, tasks: without };
    }
    const merged = [...without, task].sort((a, b) => a.position - b.position);
    return { ...c, tasks: merged };
  });
}

function ColumnDropZone({
  columnId,
  children,
  enabled,
  className,
}: {
  columnId: string;
  children: React.ReactNode;
  /** Только при перетаскивании задачи — иначе droppable участвует в коллизиях и ломает reorder колонок (особенно на соседнюю позицию). */
  enabled: boolean;
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-drop:${columnId}`,
    disabled: !enabled,
  });
  const overClass = enabled && isOver ? 'rounded-lg outline-2 outline-emerald-500/40' : '';
  return (
    <div ref={setNodeRef} className={[overClass, className].filter(Boolean).join(' ') || undefined}>
      {children}
    </div>
  );
}

export function BoardViewPage() {
  const navigate = useNavigate();
  const { workspaceId, boardId } = useParams<{ workspaceId: string; boardId: string }>();
  const wsId = useMemo(() => workspaceId ?? '', [workspaceId]);
  const bId = useMemo(() => boardId ?? '', [boardId]);

  const [columns, setColumns] = useState<ColumnWithTasks[]>([]);
  const columnsRef = useRef<ColumnWithTasks[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [columnDragTargetId, setColumnDragTargetId] = useState<string | null>(null);

  const [columnModalOpen, setColumnModalOpen] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [creatingColumn, setCreatingColumn] = useState(false);
  const [taskFormMode, setTaskFormMode] = useState<TaskFormMode | null>(null);
  const [columnEditTarget, setColumnEditTarget] = useState<Column | null>(null);
  const [editColumnName, setEditColumnName] = useState('');
  const [savingColumnName, setSavingColumnName] = useState(false);
  const [columnDeleteTarget, setColumnDeleteTarget] = useState<Column | null>(null);
  const [deletingColumn, setDeletingColumn] = useState(false);
  const [formBanner, setFormBanner] = useState<string | null>(null);

  const closeColumnModal = () => {
    setColumnModalOpen(false);
    setNewColumnName('');
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  useEffect(() => {
    const token = localStorage.getItem('doska_token');
    if (!token) {
      navigate('/login');
      return;
    }
    if (!wsId || !bId) return;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [cols, rawTasks] = await Promise.all([listColumnsByBoard(bId), listTasksByBoard(bId)]);
        const tasks = rawTasks.map(normalizeTaskFromApi);
        const grouped: ColumnWithTasks[] = cols
          .sort((a, b) => a.position - b.position)
          .map((c) => ({
            ...c,
            tasks: tasks
              .filter((t) => t.column_id === c.id && !t.is_completed)
              .sort((a, b) => a.position - b.position),
          }));
        columnsRef.current = grouped;
        setColumns(grouped);
      } catch (err: any) {
        setError(err?.response?.data?.message ?? 'Не удалось загрузить доску');
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate, wsId, bId]);

  useEffect(() => {
    columnsRef.current = columns;
  }, [columns]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
    setColumnDragTargetId(null);
  };

  const resolveColumnIdFromOver = (overId: string, cols: ColumnWithTasks[]): string | null => {
    if (overId.startsWith('column-drop:')) return overId.replace('column-drop:', '');
    if (overId.startsWith('column:')) return overId.replace('column:', '');
    if (overId.startsWith('task:')) {
      const taskId = overId.replace('task:', '');
      const col = cols.find((c) => c.tasks.some((t) => t.id === taskId));
      return col?.id ?? null;
    }
    return null;
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    const activeId = String(active.id);

    if (!activeId.startsWith('column:')) {
      setColumnDragTargetId(null);
      return;
    }

    if (!over) {
      setColumnDragTargetId(null);
      return;
    }

    const overIdRaw = String(over.id);
    const fromId = activeId.replace('column:', '');
    const hintTarget = resolveColumnIdFromOver(overIdRaw, columnsRef.current);
    setColumnDragTargetId(hintTarget && hintTarget !== fromId ? hintTarget : null);

    setColumns((prev) => {
      const toColumnId = resolveColumnIdFromOver(overIdRaw, prev);
      if (!toColumnId || toColumnId === fromId) return prev;

      const oldIndex = prev.findIndex((c) => c.id === fromId);
      const newIndex = prev.findIndex((c) => c.id === toColumnId);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return prev;

      const next = arrayMove(prev, oldIndex, newIndex).map((c, idx) => ({ ...c, position: idx + 1 }));
      const prevIds = prev.map((c) => c.id).join(',');
      const nextIds = next.map((c) => c.id).join(',');
      if (prevIds === nextIds) return prev;

      columnsRef.current = next;
      return next;
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDragId(null);
    setColumnDragTargetId(null);
    const { active, over } = event;
    const activeId = String(active.id);

    if (activeId.startsWith('column:')) {
      let ordered = columnsRef.current;
      if (over && String(over.id) !== activeId) {
        const overId = String(over.id);
        const fromId = activeId.replace('column:', '');
        const toColumnId = resolveColumnIdFromOver(overId, ordered);
        if (toColumnId && toColumnId !== fromId) {
          const oldIndex = ordered.findIndex((c) => c.id === fromId);
          const newIndex = ordered.findIndex((c) => c.id === toColumnId);
          if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
            ordered = arrayMove(ordered, oldIndex, newIndex).map((c, idx) => ({ ...c, position: idx + 1 }));
            columnsRef.current = ordered;
            setColumns(ordered);
          }
        }
      }
      try {
        await reorderColumns(bId, ordered.map((c) => c.id));
      } catch (e) {
        console.error(e);
      }
      return;
    }

    if (!over || active.id === over.id) return;

    const overId = String(over.id);

    if (!activeId.startsWith('task:')) return;
    const taskId = activeId.replace('task:', '');

    const fromColIndex = columns.findIndex((c) => c.tasks.some((t) => t.id === taskId));
    if (fromColIndex === -1) return;

    let targetColumnId = columns[fromColIndex].id;
    let targetIndex = 0;

    const dropColId = resolveColumnIdFromOver(overId, columns);

    if (dropColId && !overId.startsWith('task:')) {
      targetColumnId = dropColId;
      const targetColumn = columns.find((c) => c.id === targetColumnId);
      if (!targetColumn) return;
      targetIndex = targetColumn.tasks.length;
    } else if (overId.startsWith('task:')) {
      const overTaskId = overId.replace('task:', '');
      const targetColIndex = columns.findIndex((c) => c.tasks.some((t) => t.id === overTaskId));
      if (targetColIndex === -1) return;
      targetColumnId = columns[targetColIndex].id;
      targetIndex = columns[targetColIndex].tasks.findIndex((t) => t.id === overTaskId);
      if (targetIndex < 0) targetIndex = columns[targetColIndex].tasks.length;
    } else {
      return;
    }

    const prepared = (() => {
      const clone = columns.map((c) => ({ ...c, tasks: [...c.tasks] }));
      const fromIdx = clone.findIndex((c) => c.tasks.some((t) => t.id === taskId));
      const toIdx = clone.findIndex((c) => c.id === targetColumnId);
      if (fromIdx < 0 || toIdx < 0) return null;

      const fromTasks = clone[fromIdx].tasks;
      const oldTaskIndex = fromTasks.findIndex((t) => t.id === taskId);
      if (oldTaskIndex < 0) return null;
      const [movedTask] = fromTasks.splice(oldTaskIndex, 1);
      movedTask.column_id = clone[toIdx].id;

      const toTasks = clone[toIdx].tasks;
      const bounded = Math.max(0, Math.min(targetIndex, toTasks.length));
      toTasks.splice(bounded, 0, movedTask);

      clone[fromIdx].tasks = fromTasks.map((t, idx) => ({ ...t, position: idx + 1 }));
      clone[toIdx].tasks = toTasks.map((t, idx) => ({ ...t, position: idx + 1, column_id: clone[toIdx].id }));

      return { clone, newPosition: bounded + 1 };
    })();

    if (!prepared) return;
    setColumns(prepared.clone);

    try {
      await updateTask(taskId, { column_id: targetColumnId, position: prepared.newPosition });
    } catch (e) {
      console.error(e);
    }
  };

  const activeTask = useMemo(() => {
    if (!activeDragId?.startsWith('task:')) return null;
    const id = activeDragId.replace('task:', '');
    for (const c of columns) {
      const t = c.tasks.find((x) => x.id === id);
      if (t) return t;
    }
    return null;
  }, [activeDragId, columns]);

  const activeColumn = useMemo(() => {
    if (!activeDragId?.startsWith('column:')) return null;
    const id = activeDragId.replace('column:', '');
    return columns.find((c) => c.id === id) ?? null;
  }, [activeDragId, columns]);

  const isDraggingTask = !!activeDragId?.startsWith('task:');
  const isDraggingColumn = !!activeDragId?.startsWith('column:');

  if (!wsId || !bId) return <div className="text-zinc-300">Workspace или Board не указаны.</div>;
  if (loading) return <div className="text-zinc-300">Загрузка доски…</div>;
  if (error) return <div className="rounded border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">{error}</div>;

  return (
    <div className="flex w-full max-w-none min-h-0 flex-1 flex-col gap-6">
      {formBanner ? (
        <div className="shrink-0 rounded-lg border border-amber-900/60 bg-amber-950/40 px-3 py-2 text-sm text-amber-100">{formBanner}</div>
      ) : null}
      <div className="flex shrink-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs text-zinc-500">Доска</div>
          <h1 className="text-2xl font-semibold">Колонки и задачи</h1>
          <p className="mt-1 text-sm text-zinc-400">Drag and drop для колонок и задач.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <button type="button" className="btn-accent" onClick={() => setColumnModalOpen(true)}>
            Добавить колонку
          </button>
          <Link className="text-zinc-300 underline underline-offset-4 hover:text-white" to={`/workspaces/${wsId}/boards`}>
            ← К списку досок
          </Link>
          <Link className="text-zinc-500 hover:text-zinc-300" to="/workspaces">
            Workspaces
          </Link>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={() => {
            setActiveDragId(null);
            setColumnDragTargetId(null);
          }}
        >
          <div className="flex h-full min-h-0 w-full flex-1 flex-col">
            <div className="-mx-1 flex min-h-0 w-full flex-1 items-stretch gap-6 overflow-x-auto overflow-y-hidden pb-2 no-scrollbar sm:pb-4">
            <SortableContext items={columns.map((c) => `column:${c.id}`)} strategy={horizontalListSortingStrategy}>
              {columns.map((col) => (
                <SortableColumn
                  key={col.id}
                  id={`column:${col.id}`}
                  title={col.name}
                  taskCount={col.tasks.length}
                  isDragOverTarget={isDraggingColumn && columnDragTargetId === col.id}
                  headerActions={
                    <>
                      <button
                        type="button"
                        className="rounded p-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                        title="Переименовать колонку"
                        onClick={() => {
                          setColumnEditTarget(col);
                          setEditColumnName(col.name);
                        }}
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        className="rounded p-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-red-300"
                        title="Удалить колонку"
                        onClick={() => setColumnDeleteTarget(col)}
                      >
                        🗑
                      </button>
                    </>
                  }
                >
                  <ColumnDropZone
                    columnId={col.id}
                    enabled={isDraggingTask}
                    className="flex min-h-0 flex-1 flex-col"
                  >
                    <SortableContext items={col.tasks.map((t) => `task:${t.id}`)} strategy={verticalListSortingStrategy}>
                      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overflow-x-hidden pr-0.5">
                        {col.tasks.map((task) => (
                          <SortableTaskItem key={task.id} id={`task:${task.id}`}>
                            {({ setActivatorNodeRef, listeners }) => (
                              <div className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-950/80 p-1.5 text-sm">
                                <button
                                  type="button"
                                  ref={setActivatorNodeRef}
                                  {...listeners}
                                  className="touch-none shrink-0 cursor-grab rounded px-0.5 py-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 active:cursor-grabbing"
                                  aria-label="Переместить задачу"
                                >
                                  ⋮⋮
                                </button>
                                <button
                                  type="button"
                                  className="min-w-0 flex-1 rounded px-1 text-left hover:bg-zinc-800/50"
                                  onClick={() => setTaskFormMode({ type: 'edit', task })}
                                >
                                  <div className="mb-1 flex flex-wrap items-center gap-1">
                                    <span className="font-medium text-zinc-100">{task.title}</span>
                                    <span className={`rounded px-1 py-px text-[10px] font-medium ${priorityBadgeClass(task.priority)}`}>
                                      {priorityLabel(task.priority)}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap gap-x-2 text-[11px] text-zinc-500">
                                    {task.due_at ? (
                                      <span>
                                        до {formatDueDateRu(task.due_at)}
                                      </span>
                                    ) : null}
                                    {checklistProgress(task) ? <span>Подзадачи: {checklistProgress(task)}</span> : null}
                                    {task.description ? <span className="truncate">Есть описание</span> : null}
                                  </div>
                                </button>
                              </div>
                            )}
                          </SortableTaskItem>
                        ))}
                      </div>
                    </SortableContext>
                  </ColumnDropZone>

                  <button
                    type="button"
                    className="btn-accent-sm mt-3 w-full shrink-0"
                    onClick={() => setTaskFormMode({ type: 'create', columnId: col.id, columnName: col.name })}
                  >
                    + Задача
                  </button>
                </SortableColumn>
              ))}
            </SortableContext>
            </div>

            <DragOverlay dropAnimation={null} zIndex={10000}>
          {activeColumn ? (
            <div className="min-w-[300px] max-w-[300px] rounded-2xl border border-zinc-600/60 bg-zinc-900/95 shadow-2xl ring-1 ring-zinc-800/90">
              <div className="flex items-center justify-between gap-2 border-b border-zinc-700/90 bg-zinc-950/55 px-3 py-2.5">
                <div className="font-medium text-zinc-100">{activeColumn.name}</div>
                <span className="rounded-md bg-zinc-800/80 px-1.5 py-0.5 text-xs tabular-nums text-zinc-400">{activeColumn.tasks.length}</span>
              </div>
              <div className="space-y-2 p-3">
                {activeColumn.tasks.slice(0, 5).map((t) => (
                  <div key={t.id} className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-2 text-sm">
                    <div className="font-medium text-zinc-100">{t.title}</div>
                    <div className="text-xs text-zinc-500">{t.id.slice(0, 6)}</div>
                  </div>
                ))}
                {activeColumn.tasks.length > 5 ? (
                  <div className="text-xs text-zinc-500">…ещё {activeColumn.tasks.length - 5}</div>
                ) : null}
              </div>
            </div>
          ) : null}
          {!activeColumn && activeTask ? (
            <div className="w-[260px] rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-sm shadow-2xl">
              <div className="mb-1 flex flex-wrap items-center gap-1">
                <span className="font-medium text-zinc-100">{activeTask.title}</span>
                <span className={`rounded px-1 py-px text-[10px] ${priorityBadgeClass(activeTask.priority)}`}>
                  {priorityLabel(activeTask.priority)}
                </span>
              </div>
              {activeTask.due_at ? (
                <div className="text-xs text-zinc-500">
                  {formatDueDateRu(activeTask.due_at)}
                </div>
              ) : null}
            </div>
          ) : null}
            </DragOverlay>
          </div>
        </DndContext>
      </div>

      <Modal open={columnModalOpen} onClose={closeColumnModal} title="Новая колонка">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!newColumnName.trim()) return;
            setCreatingColumn(true);
            try {
              const col = await createColumn({ board_id: bId, name: newColumnName.trim() });
              setColumns((prev) => [...prev, { ...col, tasks: [] }]);
              closeColumnModal();
            } catch (err: any) {
              setError(err?.response?.data?.message ?? 'Не удалось создать колонку');
            } finally {
              setCreatingColumn(false);
            }
          }}
        >
          <label className="block">
            <span className="mb-1.5 block text-sm text-zinc-400">Название</span>
            <input
              autoFocus
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
              placeholder="Например: В работе"
            />
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              className="rounded-lg px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
              onClick={closeColumnModal}
            >
              Отмена
            </button>
            <button type="submit" className="btn-accent" disabled={creatingColumn}>
              {creatingColumn ? 'Создаём…' : 'Создать'}
            </button>
          </div>
        </form>
      </Modal>

      <TaskFormModal
        open={taskFormMode !== null}
        mode={taskFormMode}
        boardId={bId}
        onClose={() => setTaskFormMode(null)}
        onSaved={(task) => {
          setFormBanner(null);
          setColumns((prev) => upsertTaskInColumns(prev, normalizeTaskFromApi(task)));
        }}
        onDeleted={(taskId) => {
          setFormBanner(null);
          setColumns((prev) => prev.map((c) => ({ ...c, tasks: c.tasks.filter((t) => t.id !== taskId) })));
        }}
        onError={(msg) => setFormBanner(msg)}
      />

      <Modal open={columnEditTarget !== null} onClose={() => setColumnEditTarget(null)} title="Переименовать колонку">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!columnEditTarget || !editColumnName.trim()) return;
            setSavingColumnName(true);
            try {
              const updated = await updateColumn(columnEditTarget.id, { name: editColumnName.trim() });
              setColumns((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
              setColumnEditTarget(null);
            } catch (err: any) {
              setFormBanner(err?.response?.data?.message ?? 'Не удалось сохранить');
            } finally {
              setSavingColumnName(false);
            }
          }}
        >
          <input
            autoFocus
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 focus:border-zinc-500 focus:outline-none"
            value={editColumnName}
            onChange={(e) => setEditColumnName(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="rounded-lg px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800" onClick={() => setColumnEditTarget(null)}>
              Отмена
            </button>
            <button type="submit" className="btn-accent" disabled={savingColumnName}>
              {savingColumnName ? 'Сохранение…' : 'Сохранить'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={columnDeleteTarget !== null} onClose={() => setColumnDeleteTarget(null)} title="Удалить колонку?">
        <p className="text-sm text-zinc-400">
          Колонка «{columnDeleteTarget?.name}» и все задачи в ней будут удалены безвозвратно.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="rounded-lg px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800" onClick={() => setColumnDeleteTarget(null)}>
            Отмена
          </button>
          <button
            type="button"
            className="rounded-lg bg-red-900/80 px-4 py-2 text-sm font-medium text-red-100 hover:bg-red-800 disabled:opacity-50"
            disabled={deletingColumn}
            onClick={async () => {
              if (!columnDeleteTarget) return;
              setDeletingColumn(true);
              try {
                await deleteColumn(columnDeleteTarget.id);
                setColumns((prev) => prev.filter((c) => c.id !== columnDeleteTarget.id));
                setColumnDeleteTarget(null);
              } catch (err: any) {
                setFormBanner(err?.response?.data?.message ?? 'Не удалось удалить колонку');
              } finally {
                setDeletingColumn(false);
              }
            }}
          >
            {deletingColumn ? 'Удаление…' : 'Удалить'}
          </button>
        </div>
      </Modal>
    </div>
  );
}

