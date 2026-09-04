import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ImageItem } from '../types';
import { useStore } from '../state/store';
import { t } from '../i18n';

interface Props {
  item: ImageItem;
  index: number;
  onEdit?: (id: string) => void;
}

export function ThumbTile({ item, index, onEdit }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const rotateCw = useStore((s) => s.rotateCw);
  const removeImage = useStore((s) => s.removeImage);
  const language = useStore((s) => s.language);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const imgStyle: React.CSSProperties = {
    transform: `rotate(${item.rotation}deg)`,
    transition: 'transform 150ms ease',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative rounded-lg border border-neutral-200 bg-white shadow-sm hover:shadow-md focus-within:ring-2 focus-within:ring-blue-400"
    >
      <div
        {...attributes}
        {...listeners}
        role="button"
        aria-label={t(language, 'reorder', { name: item.fileName, position: index + 1 })}
        className="flex aspect-square cursor-grab items-center justify-center overflow-hidden rounded-t-lg bg-neutral-100 active:cursor-grabbing"
      >
        <img
          src={item.thumbnail}
          alt={item.fileName}
          draggable={false}
          style={imgStyle}
          className="max-h-full max-w-full select-none object-contain"
        />
      </div>

      <span className="pointer-events-none absolute left-2 top-2 rounded-md bg-black/70 px-1.5 py-0.5 text-xs font-semibold text-white">
        {index + 1}
      </span>

      <div className="pointer-events-none absolute right-1 top-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            rotateCw(item.id);
          }}
          title={t(language, 'rotateCw')}
          aria-label={t(language, 'rotateCw')}
          className="pointer-events-auto rounded-md bg-white/95 px-2 py-1 text-sm shadow hover:bg-white"
        >
          ⟳
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit?.(item.id);
          }}
          title={t(language, 'cropEdit')}
          aria-label={t(language, 'cropEdit')}
          className="pointer-events-auto rounded-md bg-white/95 px-2 py-1 text-sm shadow hover:bg-white"
        >
          ✂
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            removeImage(item.id);
          }}
          title={t(language, 'remove')}
          aria-label={t(language, 'remove')}
          className="pointer-events-auto rounded-md bg-white/95 px-2 py-1 text-sm text-red-600 shadow hover:bg-red-50"
        >
          ✕
        </button>
      </div>

      <div className="truncate px-2 py-1 text-xs text-neutral-600" title={item.fileName}>
        {item.fileName}
      </div>
    </div>
  );
}
