import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { GameState } from '@shared';
import { useGame } from '../store/useGame';
import { Avatar } from './atoms';

/** The drawn Chance card, held on screen long enough to read. */
export function CardOverlay({ state }: { state: GameState }) {
  const card = useGame((s) => s.cardOverlay);
  const dismiss = useGame((s) => s.dismissCard);

  useEffect(() => {
    if (!card) return;
    const timer = window.setTimeout(dismiss, 5200);
    return () => window.clearTimeout(timer);
  }, [card, dismiss]);

  const player = card ? state.players.find((p) => p.id === card.playerId) : undefined;

  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center p-6" style={{ perspective: 1200 }}>
      <AnimatePresence>
        {card && (
          <motion.button
            key={card.at}
            type="button"
            onClick={dismiss}
            className="pointer-events-auto w-full max-w-md text-left focus-visible:outline-none"
            aria-label="Dismiss card"
            // Flips over as it is drawn.
            initial={{ opacity: 0, rotateY: -100, scale: 0.85, y: 30 }}
            animate={{ opacity: 1, rotateY: 0, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: -10, transition: { duration: 0.18 } }}
            transition={{ type: 'spring', stiffness: 220, damping: 22 }}
          >
            <div className="overflow-hidden rounded-3xl border-4 border-white bg-white shadow-glass ring-2 ring-violet-300">
              <div className="bg-gradient-to-r from-violet-500 to-fuchsia-500 px-6 py-3.5 text-center font-display text-base font-bold uppercase tracking-[0.24em] text-white">
                Chance
              </div>
              <div className="space-y-4 px-7 py-7 text-center">
                <p className="text-balance font-display text-xl font-medium leading-snug text-slate-900 sm:text-2xl">
                  {card.text}
                </p>
                {player && (
                  <div className="flex items-center justify-center gap-2 text-sm text-slate-600">
                    <Avatar player={player} size={26} />
                    drawn by <span className="font-semibold text-slate-800">{player.name}</span>
                  </div>
                )}
                <div className="text-caption text-slate-400">Tap to close</div>
              </div>
            </div>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
