import { t } from '../i18n';
import { useStore } from '../state/store';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function HistoryModal({ open, onClose }: Props) {
  const language = useStore((state) => state.language);
  const entries = useStore((state) => state.importHistory);
  const clearImportHistory = useStore((state) => state.clearImportHistory);

  if (!open) return null;

  const locale = language === 'zh' ? 'zh-CN' : 'en-US';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t(language, 'history')}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <section
        className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <h2 className="text-base font-semibold text-neutral-800">{t(language, 'history')}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t(language, 'close')}
            className="rounded-md px-2 py-1 text-neutral-500 hover:bg-neutral-100"
          >
            ✕
          </button>
        </header>

        <div className="min-h-40 flex-1 overflow-y-auto p-4">
          {entries.length === 0 ? (
            <p className="py-12 text-center text-sm text-neutral-500">
              {t(language, 'noHistory')}
            </p>
          ) : (
            <ol className="space-y-3">
              {entries.map((entry) => (
                <li key={entry.id} className="rounded-lg border border-neutral-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <time className="text-sm font-medium text-neutral-700" dateTime={entry.importedAt}>
                      {new Date(entry.importedAt).toLocaleString(locale)}
                    </time>
                    <span className="text-xs text-neutral-500">
                      {t(language, 'importedSummary', {
                        imported: entry.imported,
                        skipped: entry.skipped,
                      })}
                    </span>
                  </div>
                  <ul className="mt-2 max-h-24 space-y-1 overflow-y-auto text-xs text-neutral-500">
                    {entry.files.map((file, index) => (
                      <li key={`${file}-${index}`} className="truncate" title={file}>
                        {file}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </div>

        {entries.length > 0 ? (
          <footer className="flex justify-end border-t border-neutral-200 px-4 py-3">
            <button
              type="button"
              onClick={clearImportHistory}
              className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
            >
              {t(language, 'clearHistory')}
            </button>
          </footer>
        ) : null}
      </section>
    </div>
  );
}
