import { useStore } from '../state/store';
import { t } from '../i18n';
import { openFilePicker } from './DropZone';

interface Props {
  onExport: () => void;
  onClear: () => void;
  onRevealLast: () => void;
  lastOutputPath?: string;
  busy: boolean;
  onHistory: () => void;
}

export function TopBar({ onExport, onClear, onRevealLast, lastOutputPath, busy, onHistory }: Props) {
  const items = useStore((s) => s.items);
  const status = useStore((s) => s.status);
  const language = useStore((s) => s.language);
  const setLanguage = useStore((s) => s.setLanguage);
  const canExport = items.length > 0 && !busy;

  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-neutral-200 bg-white px-4 py-3">
      <h1 className="m-0 mr-auto text-base font-semibold text-neutral-800">
        {t(language, 'appName')}
      </h1>
      <span className="text-sm text-neutral-500">
        {t(language, 'images', { count: items.length })}
      </span>
      <label className="sr-only" htmlFor="language-select">
        {t(language, 'language')}
      </label>
      <select
        id="language-select"
        value={language}
        onChange={(event) => setLanguage(event.target.value === 'zh' ? 'zh' : 'en')}
        aria-label={t(language, 'language')}
        className="rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-700"
      >
        <option value="en">{t(language, 'english')}</option>
        <option value="zh">{t(language, 'chinese')}</option>
      </select>
      <button
        type="button"
        onClick={onHistory}
        className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
      >
        {t(language, 'history')}
      </button>
      {items.length > 0 ? (
        <button
          type="button"
          onClick={onClear}
          disabled={busy}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t(language, 'clear')}
        </button>
      ) : null}
      <button
        type="button"
        onClick={openFilePicker}
        disabled={busy}
        className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {t(language, 'addImages')}
      </button>
      {status === 'done' && lastOutputPath ? (
        <button
          type="button"
          onClick={onRevealLast}
          className="rounded-md border border-emerald-300 px-3 py-1.5 text-sm text-emerald-700 hover:bg-emerald-50"
        >
          {t(language, 'openFolder')}
        </button>
      ) : null}
      <button
        type="button"
        onClick={onExport}
        disabled={!canExport}
        className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === 'exporting' ? t(language, 'exportingButton') : t(language, 'exportPdf')}
      </button>
    </header>
  );
}
