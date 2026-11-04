import { useEffect, useRef } from 'react';
import { COLOR_HEX } from '@shared';
import type { GameState, LogKind } from '@shared';
import { cx } from '../lib/format';

const KIND_STYLE: Record<LogKind, string> = {
  system: 'text-slate-500',
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

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [entries.length]);

  return (
    <div className={cx('panel flex min-h-0 flex-col overflow-hidden', className)}>
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
        <span className="label">Activity</span>
        <span className="text-[10px] text-slate-500">{entries.length}</span>
      </div>
      <div className="no-scrollbar flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {entries.length === 0 && (
          <p className="py-4 text-center text-xs text-slate-500">Nothing has happened yet.</p>
        )}
        {entries.map((entry) => {
          const player = state.players.find((p) => p.id === entry.playerId);
          return (
            <div key={entry.id} className="flex gap-2 text-[11.5px] leading-snug">
              <span
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: player ? COLOR_HEX[player.color] : '#475569' }}
              />
              <span className={cx('min-w-0 flex-1', KIND_STYLE[entry.kind])}>{entry.text}</span>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>
    </div>
  );
}
