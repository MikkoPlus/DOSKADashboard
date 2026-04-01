import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { listColumnsByBoard, type Column, createColumn, reorderColumns } from '../api/columns';
import { listTasksByBoard, type Task, createTask, updateTask } from '../api/tasks';
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
import { SortableItem } from '../components/SortableItem';
import { SortableColumn } from '../components/SortableColumn';
import { Modal } from '../components/Modal';

type ColumnWithTasks = Column & { tasks: Task[] };

function ColumnDropZone({
  columnId,
  children,
  enabled,
}: {
  columnId: string;
  children: React.ReactNode;
  /** Только при перетаскивании задачи — иначе droppable участвует в коллизиях и ломает reorder колонок (особенно на соседнюю позицию). */
  enabled: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-drop:${columnId}`,
    disabled: !enabled,
  });
  return (
    <div ref={setNodeRef} className={enabled && isOver ? 'rounded-lg outline-2 outline-emerald-500/40' : undefined}>
      {children}
    </div>
  );
}

function ColumnShell({ highlighted, children }: { highlighted: boolean; children: React.ReactNode }) {
  return <div className={highlighted ? 'rounded-xl outline-2 outline-zinc-600/60' : undefined}>{children}</div>;
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
  const [taskModalColumnId, setTaskModalColumnId] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [creatingTask, setCreatingTask] = useState(false);

  const closeColumnModal = () => {
    setColumnModalOpen(false);
    setNewColumnName('');
  };

  const closeTaskModal = () => {
    setTaskModalColumnId(null);
    setNewTaskTitle('');
  };

  const taskModalColumn = useMemo(
    () => (taskModalColumnId ? columns.find((c) => c.id === taskModalColumnId) ?? null : null),
    [taskModalColumnId, columns],
  );

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
        const [cols, tasks] = await Promise.all([listColumnsByBoard(bId), listTasksByBoard(bId)]);
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
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-xs text-zinc-500">Доска</div>
          <h1 className="text-2xl font-semibold">Колонки и задачи</h1>
          <p className="mt-1 text-sm text-zinc-400">Drag and drop для колонок и задач.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <button
            type="button"
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-zinc-200"
            onClick={() => setColumnModalOpen(true)}
          >
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
        <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
          <SortableContext items={columns.map((c) => `column:${c.id}`)} strategy={horizontalListSortingStrategy}>
            {columns.map((col) => (
              <SortableColumn
                key={col.id}
                id={`column:${col.id}`}
                header={
                  <div className="mb-2 flex cursor-grab items-center justify-between gap-2 rounded-lg bg-zinc-950/30 px-2 py-1 active:cursor-grabbing">
                    <div className="font-medium">{col.name}</div>
                    <span className="text-xs text-zinc-500">{col.tasks.length}</span>
                  </div>
                }
              >
                <ColumnShell highlighted={isDraggingColumn && columnDragTargetId === col.id}>
                  <div className="min-w-[280px] max-w-[280px] rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
                    <ColumnDropZone columnId={col.id} enabled={isDraggingTask}>
                      <SortableContext items={col.tasks.map((t) => `task:${t.id}`)} strategy={verticalListSortingStrategy}>
                        <div className="space-y-2 min-h-[24px]">
                          {col.tasks.map((task) => (
                            <SortableItem key={task.id} id={`task:${task.id}`}>
                              <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-2 text-sm">
                                <div className="mb-1 font-medium text-zinc-100">{task.title}</div>
                                <div className="text-xs text-zinc-500">{task.id.slice(0, 6)}</div>
                              </div>
                            </SortableItem>
                          ))}
                        </div>
                      </SortableContext>
                    </ColumnDropZone>

                    <button
                      type="button"
                      className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-950/50 px-3 py-2 text-xs font-medium text-zinc-200 hover:border-zinc-600 hover:bg-zinc-800/60"
                      onClick={() => setTaskModalColumnId(col.id)}
                    >
                      + Добавить задачу
                    </button>
                </div>
                </ColumnShell>
              </SortableColumn>
            ))}
          </SortableContext>
        </div>

        <DragOverlay dropAnimation={null} zIndex={10000}>
          {activeColumn ? (
            <div className="min-w-[280px] max-w-[280px] rounded-xl border border-zinc-700 bg-zinc-900/95 p-3 shadow-2xl">
              <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-zinc-950/40 px-2 py-1">
                <div className="font-medium text-zinc-100">{activeColumn.name}</div>
                <span className="text-xs text-zinc-400">{activeColumn.tasks.length}</span>
              </div>
              <div className="space-y-2">
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
            <div className="w-[240px] rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-sm shadow-2xl">
              <div className="font-medium text-zinc-100">{activeTask.title}</div>
              <div className="text-xs text-zinc-500">{activeTask.id.slice(0, 6)}</div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

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
            <button
              type="submit"
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-zinc-200 disabled:opacity-60"
              disabled={creatingColumn}
            >
              {creatingColumn ? 'Создаём…' : 'Создать'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={taskModalColumnId !== null}
        onClose={closeTaskModal}
        title={taskModalColumn ? `Новая задача — «${taskModalColumn.name}»` : 'Новая задача'}
      >
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const colId = taskModalColumnId;
            if (!colId || !newTaskTitle.trim()) return;
            setCreatingTask(true);
            try {
              const task = await createTask({ board_id: bId, column_id: colId, title: newTaskTitle.trim() });
              setColumns((prev) => prev.map((c) => (c.id === colId ? { ...c, tasks: [...c.tasks, task] } : c)));
              closeTaskModal();
            } catch (err: any) {
              setError(err?.response?.data?.message ?? 'Не удалось создать задачу');
            } finally {
              setCreatingTask(false);
            }
          }}
        >
          <label className="block">
            <span className="mb-1.5 block text-sm text-zinc-400">Заголовок задачи</span>
            <input
              autoFocus
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Что нужно сделать?"
            />
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="rounded-lg px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800" onClick={closeTaskModal}>
              Отмена
            </button>
            <button
              type="submit"
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-zinc-200 disabled:opacity-60"
              disabled={creatingTask}
            >
              {creatingTask ? 'Добавляем…' : 'Добавить'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

