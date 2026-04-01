import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export function SortableColumn({
  id,
  title,
  taskCount,
  headerActions,
  children,
  isDragOverTarget = false,
}: {
  id: string;
  title: string;
  taskCount: number;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
  isDragOverTarget?: boolean;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition,
    opacity: isDragging ? 0 : 1,
    pointerEvents: isDragging ? 'none' : 'auto',
  };

  const cardRing = isDragOverTarget
    ? 'border-zinc-400/50 ring-2 ring-zinc-400/30'
    : 'border-zinc-600/60 ring-zinc-800/90';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="h-full min-h-0 min-w-[min(100vw-3rem,300px)] max-w-[300px] shrink-0 self-stretch sm:min-w-[300px]"
    >
      <div
        className={`flex h-full min-h-0 flex-col rounded-2xl border bg-zinc-900/85 shadow-lg shadow-black/25 ring-1 ${cardRing} backdrop-blur-sm`}
      >
        <div className="flex shrink-0 items-center gap-1.5 rounded-t-2xl border-b border-zinc-700/90 bg-zinc-950/55 px-2 py-2">
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...listeners}
            className="touch-none shrink-0 cursor-grab rounded p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 active:cursor-grabbing"
            aria-label="Переместить колонку"
          >
            <span className="block text-xs leading-none tracking-tighter">⋮⋮</span>
          </button>
          <div className="min-w-0 flex-1 truncate font-medium text-zinc-100">{title}</div>
          <span className="shrink-0 rounded-md bg-zinc-800/80 px-1.5 py-0.5 text-xs tabular-nums text-zinc-400">{taskCount}</span>
          {headerActions ? <div className="flex shrink-0 items-center gap-0.5">{headerActions}</div> : null}
        </div>
        <div className="flex min-h-0 flex-1 flex-col p-3">{children}</div>
      </div>
    </div>
  );
}
