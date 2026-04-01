import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export function SortableColumn({
  id,
  header,
  children,
}: {
  id: string;
  header: React.ReactNode;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition,
    // visibility:hidden иногда оставляет “призраки” вложенных элементов в некоторых комбинациях DnD/outline.
    // opacity:0 надёжно скрывает весь столбец, сохраняя место под placeholder.
    opacity: isDragging ? 0 : 1,
    pointerEvents: isDragging ? 'none' : 'auto',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div ref={setActivatorNodeRef} {...listeners}>
        {header}
      </div>
      {children}
    </div>
  );
}

