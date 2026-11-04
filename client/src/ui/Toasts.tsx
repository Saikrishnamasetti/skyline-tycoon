import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { cx } from '../lib/format';
import { useGame } from '../store/useGame';
import type { Toast } from '../store/useGame';

const TONE: Record<Toast['tone'], string> = {
  good: 'border-emerald-200 bg-emerald-50/95 text-emerald-900',
  bad: 'border-rose-200 bg-rose-50/95 text-rose-900',
  info: 'border-sky-200 bg-sky-50/95 text-sky-900',
  gold: 'border-amber-200 bg-amber-50/95 text-amber-900',
};

const DOT: Record<Toast['tone'], string> = {
  good: 'bg-emerald-500',
  bad: 'bg-rose-500',
  info: 'bg-sky-500',
  gold: 'bg-amber-500',
};

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useGame((s) => s.dismissToast);
  useEffect(() => {
    const timer = window.setTimeout(() => dismiss(toast.id), 4200);
    return () => window.clearTimeout(timer);
  }, [toast.id, dismiss]);

  return (
    <motion.button
      layout
      type="button"
      onClick={() => dismiss(toast.id)}
      initial={{ opacity: 0, y: -14, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 480, damping: 34 }}
      className={cx(
        'pointer-events-auto flex w-full items-start gap-3 rounded-2xl border-2 px-4 py-3 text-left font-display shadow-glass backdrop-blur',
        TONE[toast.tone],
      )}
    >
      <span className={cx('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', DOT[toast.tone])} aria-hidden />
      <span className="min-w-0">
        <span className="block text-base font-semibold leading-tight">{toast.title}</span>
        {toast.detail && <span className="mt-0.5 block text-sm opacity-80">{toast.detail}</span>}
      </span>
    </motion.button>
  );
}

export function Toasts() {
  const toasts = useGame((s) => s.toasts);
  return (
    <div
      className="pointer-events-none fixed left-1/2 top-[4.5rem] z-40 flex w-[min(24rem,calc(100vw-1.5rem))] -translate-x-1/2 flex-col gap-2"
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </AnimatePresence>
    </div>
  );
}
