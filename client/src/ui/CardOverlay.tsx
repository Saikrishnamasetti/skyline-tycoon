import { useEffect } from 'react';
import type { GameState } from '@shared';
import { useGame } from '../store/useGame';
import { Avatar } from './atoms';

/** The drawn Chance card, held on screen long enough to read. */
export function CardOverlay({ state }: { state: GameState }) {
  const card = useGame((s) => s.cardOverlay);
  const dismiss = useGame((s) => s.dismissCard);

  useEffect(() => {
    if (!card) return;
    const timer = window.setTimeout(dismiss, 4600);
    return () => window.clearTimeout(timer);
  }, [card, dismiss]);

  if (!card) return null;
  const player = state.players.find((p) => p.id === card.playerId);

  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center p-6">
      <button
        type="button"
        onClick={dismiss}
        className="pointer-events-auto w-full max-w-sm animate-pop-in text-left"
        aria-label="Dismiss card"
      >
        {/* A solid dark card: it floats over the brightest part of the board. */}
        <div className="overflow-hidden rounded-3xl border border-violet-400/50 bg-white shadow-glass">
          <div className="bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-3 text-center font-display text-sm font-bold uppercase tracking-[0.22em] text-white">
            Chance
          </div>
          <div className="space-y-3 px-6 py-6 text-center">
            <p className="text-balance text-[15px] font-medium leading-relaxed text-slate-900">{card.text}</p>
            {player && (
              <div className="flex items-center justify-center gap-2 text-[11px] text-slate-700">
                <Avatar player={player} size={20} />
                drawn by {player.name}
              </div>
            )}
          </div>
        </div>
      </button>
    </div>
  );
}
