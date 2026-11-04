import { WIN_LABEL, netWorth } from '@shared';
import type { GameState, Player } from '@shared';
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
          <div className="flex items-center gap-3 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3">
            <Avatar player={winner} size={48} />
            <div>
              <div className="font-display text-lg font-bold text-amber-700">{winner.name}</div>
              {state.winReason && (
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                  {WIN_LABEL[state.winReason]}
                </div>
              )}
              <div className="text-[12px] text-amber-700/80">
                Final net worth <Money amount={netWorth(state, winner.id)} />
              </div>
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <span className="label">Final standings</span>
          {standings.map((entry, i) => (
            <div
              key={entry.player.id}
              className={cx(
                'flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2',
                i === 0 ? 'bg-slate-100' : 'bg-slate-50',
                entry.player.bankrupt && 'opacity-55',
              )}
            >
              <span className="w-5 text-center font-display text-sm font-bold text-slate-500">
                {i + 1}
              </span>
              <Avatar player={entry.player} size={30} dim={entry.player.bankrupt} />
              <span className="flex-1 truncate text-sm text-slate-900">{entry.player.name}</span>
              {entry.player.bankrupt ? (
                <span className="text-[11px] uppercase tracking-wide text-rose-700">Bankrupt</span>
              ) : (
                <Money amount={entry.worth} className="text-sm text-slate-800" />
              )}
            </div>
          ))}
        </div>

        <p className="text-[11.5px] text-slate-500">
          Net worth counts cash plus everything built on each city and the price of each resort.
        </p>
      </div>
    </Modal>
  );
}
