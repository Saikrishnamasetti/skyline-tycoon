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
        'panel px-2.5 py-1.5 font-mono text-[12px] font-semibold',
        left <= 60 ? 'text-neon-rose' : 'text-slate-800',
      )}
      title="When the clock runs out, the richest tycoon wins"
    >
      {minutes}:{seconds.toString().padStart(2, '0')}
    </span>
  );
}
