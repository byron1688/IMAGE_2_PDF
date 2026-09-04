import { useStore } from '../state/store';
import { t } from '../i18n';

export default function StatusBar() {
  const status = useStore((s) => s.status);
  const progress = useStore((s) => s.progress);
  const lastError = useStore((s) => s.lastError);
  const language = useStore((s) => s.language);

  const pct = progress.total > 0 ? Math.min(100, Math.round((progress.current / progress.total) * 100)) : 0;
  const showBar = status === 'importing' || status === 'exporting' || (status === 'done' && progress.total > 0);
  const label =
    status === 'error'
      ? t(language, 'error', { message: lastError ?? 'unknown' })
      : status === 'exporting'
      ? t(language, 'exporting', { current: progress.current, total: progress.total })
      : status === 'importing'
      ? t(language, 'importing', { current: progress.current, total: progress.total })
      : status === 'done'
      ? t(language, 'done', { count: progress.total })
      : t(language, 'ready');

  return (
    <footer
      role="status"
      aria-live="polite"
      style={{
        borderTop: '1px solid #e5e5e5',
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        fontSize: 13,
        background: '#fafafa',
      }}
    >
      <span style={{ color: status === 'error' ? 'crimson' : '#333', flex: 1 }}>{label}</span>
      {showBar ? (
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={progress.total}
          aria-valuenow={progress.current}
          style={{
            width: 200,
            height: 6,
            background: '#e5e5e5',
            borderRadius: 3,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: '100%',
              background: status === 'done' ? '#2e7d32' : '#1976d2',
              transition: 'width 120ms linear',
            }}
          />
        </div>
      ) : null}
    </footer>
  );
}
