import { WIN_LABEL, netWorth } from '@shared';
import type { GameState, Player } from '@shared';
import { motion } from 'motion/react';
import { cx } from '../lib/format';
import { api } from '../net/socket';
import { Avatar, Modal, Money } from './atoms';

export function GameOver({
  state,
  me,
  onLeave,
}: {
  state: GameState;
  me: Player | null;
  onLeave: () => void;
}) {
  if (state.status !== 'finished') return null;
  const winner = state.players.find((p) => p.id === state.winnerId) ?? null;
  const iWon = !!me && me.id === state.winnerId;

  const standings = [...state.players]
    .map((player) => ({ player, worth: player.bankrupt ? 0 : netWorth(state, player.id) }))
    .sort((a, b) => b.worth - a.worth);

  return (
    <Modal
      open
      dismissible={false}
      onClose={onLeave}
      title={iWon ? 'You built the skyline' : 'Game over'}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onLeave}>
            Back to the lobby list
          </button>
          {me?.id === state.hostId && (
            <button type="button" className="btn-primary" onClick={() => void api.rematch()}>
              Rematch
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {winner && (
          <motion.div
            className="flex items-center gap-4 rounded-2xl border-2 border-amber-300 bg-amber-50 px-5 py-4"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
          >
            <Avatar player={winner} size={64} />
            <div>
              <div className="font-display text-2xl font-bold text-amber-800">{winner.name}</div>
              {state.winReason && (
                <div className="text-sm font-bold uppercase tracking-[0.16em] text-amber-700">
                  {WIN_LABEL[state.winReason]}
                </div>
              )}
              <div className="text-base text-amber-800/90">
                Final net worth <Money amount={netWorth(state, winner.id)} />
              </div>
            </div>
          </motion.div>
        )}

        <div className="space-y-2">
          <span className="label">Final standings</span>
          {standings.map((entry, i) => (
            <motion.div
              key={entry.player.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.2 + i * 0.06 }}
              className={cx(
                'flex items-center gap-3 rounded-xl border-2 border-slate-200 px-4 py-2.5',
                i === 0 ? 'bg-slate-100' : 'bg-slate-50',
                entry.player.bankrupt && 'opacity-55',
              )}
            >
              <span className="w-6 text-center font-display text-lg font-bold text-slate-500">
                {i + 1}
              </span>
              <Avatar player={entry.player} size={40} dim={entry.player.bankrupt} />
              <span className="flex-1 truncate text-base font-semibold text-slate-900">{entry.player.name}</span>
              {entry.player.bankrupt ? (
                <span className="text-sm font-bold uppercase tracking-wide text-rose-700">Bankrupt</span>
              ) : (
                <Money amount={entry.worth} className="text-base font-semibold text-slate-800" />
              )}
            </motion.div>
          ))}
        </div>

        <p className="text-sm text-slate-500">
          Net worth counts cash plus everything built on each city and the price of each resort.
        </p>
      </div>
    </Modal>
  );
}
