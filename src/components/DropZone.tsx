import { type ReactNode, useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { addImages } from '../ipc';
import { t } from '../i18n';
import { useStore } from '../state/store';

export const IMAGE_EXTENSIONS = [
  'jpg',
  'jpeg',
  'png',
  'webp',
  'bmp',
  'gif',
  'tif',
  'tiff',
  'heic',
  'heif',
];

async function importPaths(paths: string[]) {
  if (paths.length === 0) return;
  const {
    setStatus,
    setProgress,
    setError,
    addImages: addToStore,
    recordImport,
    language,
  } = useStore.getState();
  setError(undefined);
  setStatus('importing');
  setProgress(0, paths.length, t(language, 'importing', { current: 0, total: paths.length }));
  try {
    const result = await addImages(paths);
    const existingPaths = new Set(useStore.getState().items.map((item) => item.path));
    const importedPaths = new Set<string>();
    for (const item of result.items) {
      if (!existingPaths.has(item.path)) importedPaths.add(item.path);
    }
    const importedCount = importedPaths.size;
    addToStore(result.items);
    recordImport({
      files: paths.map((path) => path.split(/[\\/]/).pop() ?? path),
      imported: importedCount,
      skipped: Math.max(result.errors.length, paths.length - importedCount),
    });
    if (result.errors.length > 0) {
      setError(
        t(language, 'skippedFiles', {
          count: result.errors.length,
          message: result.errors[0].message,
        }),
      );
    } else {
      setStatus('idle');
    }
    setProgress(
      paths.length,
      paths.length,
      t(language, 'imported', { count: importedCount }),
    );
  } catch (e) {
    recordImport({
      files: paths.map((path) => path.split(/[\\/]/).pop() ?? path),
      imported: 0,
      skipped: paths.length,
    });
    setError(e instanceof Error ? e.message : String(e));
  }
}

export async function openFilePicker() {
  const language = useStore.getState().language;
  const selected = await openDialog({
    multiple: true,
    filters: [{ name: language === 'zh' ? '图片' : 'Images', extensions: IMAGE_EXTENSIONS }],
  });
  if (!selected) return;
  const paths = Array.isArray(selected) ? selected : [selected];
  await importPaths(paths);
}

export function DropZone({ children }: { children: ReactNode }) {
  const [dragOver, setDragOver] = useState(false);
  const language = useStore((state) => state.language);

  // Tauri's webview event supplies real filesystem paths for OS drops. The
  // react-dropzone root deliberately spans the complete window so its drag
  // state and accessibility semantics are not limited to the empty state.
  const accept = Object.fromEntries(IMAGE_EXTENSIONS.map((e) => [`image/${e}`, [`.${e}`]]));
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept,
    noClick: true,
    noKeyboard: true,
    onDrop: (files) => {
      // Some desktop webviews expose a non-standard File.path. Import it when
      // present; current Tauri versions otherwise deliver the same drop to the
      // webview event listener below with canonical filesystem paths.
      const paths = files
        .map((file) => (file as File & { path?: string }).path)
        .filter((path): path is string => Boolean(path));
      if (paths.length > 0) void importPaths(paths);
    },
  });

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    getCurrentWebview()
      .onDragDropEvent((event) => {
        const t = event.payload.type;
        if (t === 'enter' || t === 'over') {
          setDragOver(true);
        } else if (t === 'leave') {
          setDragOver(false);
        } else if (t === 'drop') {
          setDragOver(false);
          const paths = (event.payload as { paths: string[] }).paths ?? [];
          const filtered = paths.filter((p) => {
            const ext = p.split('.').pop()?.toLowerCase() ?? '';
            return IMAGE_EXTENSIONS.includes(ext);
          });
          void importPaths(filtered);
        }
      })
      .then((fn) => {
        if (cancelled) fn();
        else unlisten = fn;
      });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  const highlight = dragOver || isDragActive;

  return (
    <div
      {...getRootProps({
        className: 'relative flex min-h-screen flex-col bg-neutral-50 text-neutral-900',
      })}
    >
      <input {...getInputProps()} />
      {highlight ? (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center border-4 border-dashed border-blue-500 bg-blue-500/10 text-lg font-semibold text-blue-700">
          {t(language, 'drop')}
        </div>
      ) : null}
      {children}
    </div>
  );
}

export function EmptyDropPrompt() {
  const language = useStore((state) => state.language);
  return (
    <button
      type="button"
      onClick={() => void openFilePicker()}
      className="m-6 flex min-h-[50vh] w-[calc(100%-3rem)] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-neutral-300 bg-white p-8 text-neutral-500 transition-colors hover:border-blue-400 hover:text-blue-600"
    >
      <span className="text-2xl">＋</span>
      <span className="text-base font-medium">{t(language, 'empty')}</span>
      <span className="text-xs text-neutral-400">JPG · PNG · WebP · HEIC · BMP · GIF · TIFF</span>
    </button>
  );
}
