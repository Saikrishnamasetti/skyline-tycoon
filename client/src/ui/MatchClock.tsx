import type { GameState } from '@shared';
import { cx } from '../lib/format';
import { useNow } from '../hooks/useNow';

/** Time left in the match. When it hits zero the richest player wins. */
export function MatchClock({ state }: { state: GameState }) {
  const now = useNow(1000);
  if (!state.endsAt || state.status !== 'playing') return null;
  const left = Math.max(0, Math.ceil((state.endsAt - now) / 1000));
  const minutes = Math.floor(left / 60);
  const seconds = left % 60;
  return (
    <span
      className={cx(
        'rounded-full bg-slate-100 px-3 py-1 font-mono text-sm font-bold tabular-nums',
        left <= 60 ? 'text-rose-600' : 'text-slate-800',
      )}
      title="When the clock runs out, the richest tycoon wins"
    >
      {minutes}:{seconds.toString().padStart(2, '0')}
    </span>
  );
}
