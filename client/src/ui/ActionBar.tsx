import { formatCompact, tileAt } from '@shared';
import type { GameState, Player } from '@shared';
import { secondsLeft } from '../lib/format';
import { useActions } from '../hooks/useActions';
import { useNow } from '../hooks/useNow';
import {
  BuildPanel,
  BuyoutPanel,
  ChampionshipPanel,
  DebtPanel,
  Shell,
  Waiting,
  travelDestinations,
} from './DecisionPanels';

interface ActionBarProps {
  state: GameState;
  me: Player | null;
  onOpenPortfolio: () => void;
  onOpenTrade: () => void;
}

/**
 * The primary control surface. Only the moves the server would accept are
 * offered, so a player is never invited to make an illegal one.
 */
export function ActionBar({ state, me, onOpenPortfolio, onOpenTrade }: ActionBarProps) {
  const act = useActions();
  const now = useNow(500);
  const seconds = secondsLeft(state.deadline, now);
  const total = state.phase === 'in_debt' ? state.settings.debtSeconds : state.settings.turnSeconds;
  const timer = { seconds, total };

  if (!me || state.status !== 'playing') return null;
  if (me.bankrupt) {
    return (
      <Shell>
        <p className="text-sm text-slate-500">You are out of the game. Stay and see who wins.</p>
      </Shell>
    );
  }

  const nameOf = (id: string | undefined) => state.players.find((p) => p.id === id)?.name ?? 'Someone';

  if (state.phase === 'in_debt' && state.pendingDebt) {
    return state.pendingDebt.debtorId === me.id ? (
      <Shell timer={timer} tone="danger">
        <DebtPanel state={state} me={me} onOpenPortfolio={onOpenPortfolio} />
      </Shell>
    ) : (
      <Shell timer={timer}>
        <Waiting label={`${nameOf(state.pendingDebt.debtorId)} is raising money to pay a debt`} />
      </Shell>
    );
  }

  if (state.phase === 'build' && state.buildOffer) {
    return state.buildOffer.playerId === me.id ? (
      <Shell timer={timer} tone="gold">
        <BuildPanel state={state} me={me} />
      </Shell>
    ) : (
      <Shell timer={timer}>
        <Waiting label={`${nameOf(state.buildOffer.playerId)} is deciding what to build in ${tileAt(state.buildOffer.tile).name}`} />
      </Shell>
    );
  }

  if (state.phase === 'buyout' && state.buyoutOffer) {
    return state.buyoutOffer.playerId === me.id ? (
      <Shell timer={timer} tone="gold">
        <BuyoutPanel state={state} me={me} />
      </Shell>
    ) : (
      <Shell timer={timer}>
        <Waiting label={`${nameOf(state.buyoutOffer.playerId)} is weighing a buyout of ${tileAt(state.buyoutOffer.tile).name}`} />
      </Shell>
    );
  }

  if (state.phase === 'championship' && state.championshipOffer) {
    return state.championshipOffer.playerId === me.id ? (
      <Shell timer={timer} tone="gold">
        <ChampionshipPanel state={state} me={me} />
      </Shell>
    ) : (
      <Shell timer={timer}>
        <Waiting label={`${nameOf(state.championshipOffer.playerId)} is choosing a championship city`} />
      </Shell>
    );
  }

  const isMyTurn = state.order[state.currentIndex] === me.id;
  if (!isMyTurn) {
    return (
      <Shell timer={timer}>
        <Waiting label={`${nameOf(state.order[state.currentIndex])} is taking their turn`} />
        <button type="button" className="btn-ghost" onClick={onOpenPortfolio}>
          My cities
        </button>
      </Shell>
    );
  }

  const destinations = travelDestinations(state, me);
  const ticket = state.settings.worldTourFee;
  const canFly = me.travelPending && me.cash >= ticket && destinations.length > 0;

  return (
    <Shell timer={timer}>
      <div className="flex min-w-[10rem] flex-1 flex-col gap-0.5">
        <span className="font-display text-sm font-semibold text-neon-cyan">Your turn</span>
        <span className="text-[11px] text-slate-500">
          {me.onIsland
            ? `Stranded on the Island - attempt ${me.islandTurns + 1} of 3. Roll doubles to escape.`
            : canFly
              ? `World Tour: tap a glowing city to fly there for ${formatCompact(ticket)}, or roll as usual.`
              : state.lastDoubles
                ? 'Doubles! Roll again.'
                : 'Roll the dice to move.'}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {me.onIsland && me.escapeCards > 0 && (
          <button type="button" className="btn-ghost" onClick={() => act({ type: 'useEscape' })}>
            Use escape card
          </button>
        )}
        {me.onIsland && (
          <button
            type="button"
            className="btn-ghost"
            disabled={me.cash < state.settings.islandFee}
            onClick={() => act({ type: 'payIslandFee' })}
          >
            Take the boat - {formatCompact(state.settings.islandFee)}
          </button>
        )}
        {canFly && (
          <select
            className="field w-auto py-2 pr-8 text-sm"
            value=""
            onChange={(event) => {
              const tile = Number(event.target.value);
              if (Number.isInteger(tile)) act({ type: 'travel', tile });
            }}
            aria-label="Choose a World Tour destination"
          >
            <option value="" disabled>
              Fly to...
            </option>
            {destinations.map((index) => (
              <option key={index} value={index}>
                {tileAt(index).name}
              </option>
            ))}
          </select>
        )}
        <button type="button" className="btn-ghost" onClick={onOpenPortfolio}>
          My cities
        </button>
        {state.settings.tradingEnabled && (
          <button type="button" className="btn-ghost" onClick={onOpenTrade}>
            Trade
          </button>
        )}
        <button type="button" className="btn-primary min-w-[8.5rem] animate-pulse-ring" onClick={() => act({ type: 'roll' })}>
          {me.onIsland ? 'Roll for doubles' : canFly ? 'Roll instead' : 'Roll dice'}
        </button>
      </div>
    </Shell>
  );
}
