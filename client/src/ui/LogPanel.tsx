import { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { COLOR_HEX } from '@shared';
import type { GameState, LogKind } from '@shared';
import { cx } from '../lib/format';

const KIND_STYLE: Record<LogKind, string> = {
  system: 'text-slate-600',
  roll: 'text-sky-700',
  money: 'text-emerald-700',
  property: 'text-amber-700',
  card: 'text-violet-700',
  island: 'text-sky-700',
  win: 'text-amber-700',
  trade: 'text-cyan-700',
  danger: 'text-rose-700',
};

export function LogPanel({ state, className }: { state: GameState; className?: string }) {
  const bottom = useRef<HTMLDivElement>(null);
  const entries = state.log;
  // Entries already on screen when the panel opens appear at once; only new ones animate.
  const firstId = useRef(entries[entries.length - 1]?.id);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [entries.length]);

  return (
    <div className={cx('panel flex min-h-0 flex-col overflow-hidden', className)}>
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
        <span className="label">Activity</span>
        <span className="chip">{entries.length}</span>
      </div>
      <div className="no-scrollbar flex-1 space-y-1.5 overflow-y-auto px-4 py-3" aria-live="polite">
        {entries.length === 0 && (
          <p className="py-4 text-center text-sm text-slate-500">Nothing has happened yet.</p>
        )}
        {entries.map((entry) => {
          const player = state.players.find((p) => p.id === entry.playerId);
          const fresh = firstId.current === undefined || entry.id > firstId.current;
          return (
            <motion.div
              key={entry.id}
              className="flex gap-2.5 text-sm leading-snug"
              initial={fresh ? { opacity: 0, x: 12 } : false}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              <span
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                style={{ background: player ? COLOR_HEX[player.color] : '#475569' }}
              />
              <span className={cx('min-w-0 flex-1', KIND_STYLE[entry.kind])}>{entry.text}</span>
            </motion.div>
          );
        })}
        <div ref={bottom} />
      </div>
    </div>
  );
}
