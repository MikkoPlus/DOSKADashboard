import React from 'react';
import type { DraggableSyntheticListeners } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type HandleProps = {
  setActivatorNodeRef: (element: HTMLElement | null) => void;
  listeners: DraggableSyntheticListeners;
};

type Props = {
  id: string;
  children: (handle: HandleProps) => React.ReactNode;
};

export function SortableTaskItem({ id, children }: Props) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition,
    opacity: isDragging ? 0 : 1,
    pointerEvents: isDragging ? 'none' : 'auto',
    zIndex: isDragging ? 9999 : 'auto',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      {children({ setActivatorNodeRef, listeners })}
    </div>
  );
}
