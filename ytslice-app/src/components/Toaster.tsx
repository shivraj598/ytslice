import type { ToastItem } from '../hooks/useToast';
import { IconAlert, IconCheck, IconSparkle, IconX } from './icons';

interface ToasterProps {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}

export function Toaster({ toasts, onDismiss }: ToasterProps) {
  if (toasts.length === 0) return null;
  return (
    <div className="toaster" role="region" aria-live="polite" aria-label="Notifications">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          <span className="t-icon">
            {t.kind === 'success' ? (
              <IconCheck />
            ) : t.kind === 'error' ? (
              <IconAlert />
            ) : (
              <IconSparkle />
            )}
          </span>
          <div className="t-body">
            <div className="t-title">{t.title}</div>
            {t.message && <div className="t-msg">{t.message}</div>}
          </div>
          <button
            className="btn btn-ghost btn-icon btn-sm"
            style={{ marginLeft: 'auto', height: 24, width: 24 }}
            onClick={() => onDismiss(t.id)}
            aria-label="Dismiss"
          >
            <IconX />
          </button>
        </div>
      ))}
    </div>
  );
}
