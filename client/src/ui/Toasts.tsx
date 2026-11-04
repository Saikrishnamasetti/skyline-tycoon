import { useEffect } from 'react';
import { cx } from '../lib/format';
import { useGame } from '../store/useGame';
import type { Toast } from '../store/useGame';

const TONE: Record<Toast['tone'], string> = {
  good: 'border-white bg-emerald-50/95 text-emerald-800',
  bad: 'border-white bg-rose-50/95 text-rose-800',
  info: 'border-white bg-sky-50/95 text-sky-800',
  gold: 'border-white bg-amber-50/95 text-amber-800',
};

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useGame((s) => s.dismissToast);
  useEffect(() => {
    const timer = window.setTimeout(() => dismiss(toast.id), 4200);
    return () => window.clearTimeout(timer);
  }, [toast.id, dismiss]);

  return (
    <button
      type="button"
      onClick={() => dismiss(toast.id)}
      className={cx(
        'pointer-events-auto w-full rounded-2xl border-2 px-3.5 py-2 text-left font-display shadow-glass animate-pop-in',
        TONE[toast.tone],
      )}
    >
      <div className="text-[13px] font-semibold leading-tight">{toast.title}</div>
      {toast.detail && <div className="mt-0.5 text-[11px] opacity-80">{toast.detail}</div>}
    </button>
  );
}

export function Toasts() {
  const toasts = useGame((s) => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed left-1/2 top-16 z-40 flex w-[min(20rem,calc(100vw-1.5rem))] -translate-x-1/2 flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
