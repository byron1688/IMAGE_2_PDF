import { useEffect, useState } from 'react';
import { DropZone, EmptyDropPrompt } from './components/DropZone';
import { EditModal } from './components/EditModal';
import { HistoryModal } from './components/HistoryModal';
import StatusBar from './components/StatusBar';
import { ThumbGrid } from './components/ThumbGrid';
import { TopBar } from './components/TopBar';
import {
  exportPdf,
  onExportProgress,
  pickSavePath,
  revealInFolder,
  toPdfItems,
} from './ipc';
import { useStore } from './state/store';
import { t } from './i18n';

export default function App() {
  const items = useStore((s) => s.items);
  const status = useStore((s) => s.status);
  const lastError = useStore((s) => s.lastError);
  const setStatus = useStore((s) => s.setStatus);
  const setError = useStore((s) => s.setError);
  const setProgress = useStore((s) => s.setProgress);
  const clear = useStore((s) => s.clear);
  const language = useStore((s) => s.language);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [lastOutputPath, setLastOutputPath] = useState<string | undefined>();

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    onExportProgress(({ current, total }) => {
      setProgress(current, total, t(language, 'rendering', { current, total }));
    }).then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [language, setProgress]);

  useEffect(() => {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  }, [language]);

  const busy = status === 'exporting' || status === 'importing';

  const handleExport = async () => {
    if (items.length === 0 || busy) return;
    setError(undefined);
    try {
      const outputPath = await pickSavePath();
      if (!outputPath) return;
      setStatus('exporting');
      setProgress(0, items.length, t(language, 'exporting', { current: 0, total: items.length }));
      await exportPdf(toPdfItems(items), outputPath);
      setLastOutputPath(outputPath);
      setProgress(
        items.length,
        items.length,
        t(language, 'exported', { count: items.length }),
      );
      setStatus('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleRevealLast = async () => {
    if (!lastOutputPath) return;
    try {
      await revealInFolder(lastOutputPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <DropZone>
      <TopBar
        onExport={handleExport}
        onClear={clear}
        onRevealLast={handleRevealLast}
        lastOutputPath={lastOutputPath}
        busy={busy}
        onHistory={() => setHistoryOpen(true)}
      />
      <main className="relative flex-1">
        {lastError ? (
          <div className="mx-4 mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {lastError}
          </div>
        ) : null}
        {items.length === 0 ? <EmptyDropPrompt /> : null}
        <ThumbGrid onEdit={setEditingId} />
      </main>
      <StatusBar />
      <EditModal itemId={editingId} onClose={() => setEditingId(null)} />
      <HistoryModal open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </DropZone>
  );
}
