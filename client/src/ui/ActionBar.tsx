import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { formatCompact, tileAt } from '@shared';
import type { GameState, Player } from '@shared';
import { secondsLeft } from '../lib/format';
import { useActions } from '../hooks/useActions';
import { useNow } from '../hooks/useNow';
import { useGame } from '../store/useGame';
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
 * offered, so a player is never invited to make an illegal one. While the
 * dice and the piece are still moving on screen, the next decision waits.
 */
export function ActionBar(props: ActionBarProps) {
  const { state, me } = props;
  const now = useNow(250);
  const movingUntil = useGame((s) => s.movingUntil);
  if (!me || state.status !== 'playing') return null;

  const moving = !me.bankrupt && now < movingUntil;
  const { key, node } = moving ? movingPanel(state, me) : panelFor(props, now);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={key}
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}
        transition={{ type: 'spring', stiffness: 460, damping: 34 }}
      >
        {node}
      </motion.div>
    </AnimatePresence>
  );
}

function movingPanel(state: GameState, me: Player): { key: string; node: ReactNode } {
  const current = state.players.find((p) => p.id === state.order[state.currentIndex]);
  const label = current?.id === me.id ? 'On the move...' : `${current?.name ?? 'Someone'} is on the move...`;
  return {
    key: 'moving',
    node: (
      <Shell>
        <Waiting label={label} />
      </Shell>
    ),
  };
}

function panelFor(
  { state, me, onOpenPortfolio, onOpenTrade }: ActionBarProps,
  now: number,
): { key: string; node: ReactNode } {
  // Narrowed by the caller.
  const player = me as Player;
  const seconds = secondsLeft(state.deadline, now);
  const total = state.phase === 'in_debt' ? state.settings.debtSeconds : state.settings.turnSeconds;
  const timer = { seconds, total };
  const nameOf = (id: string | undefined) => state.players.find((p) => p.id === id)?.name ?? 'Someone';

  if (player.bankrupt) {
    return {
      key: 'out',
      node: (
        <Shell>
          <p className="text-base text-slate-600">You are out of the game. Stay and see who wins.</p>
        </Shell>
      ),
    };
  }

  if (state.phase === 'in_debt' && state.pendingDebt) {
    const mine = state.pendingDebt.debtorId === player.id;
    return {
      key: `debt-${mine}`,
      node: mine ? (
        <Shell timer={timer} tone="danger">
          <DebtPanel state={state} me={player} onOpenPortfolio={onOpenPortfolio} />
        </Shell>
      ) : (
        <Shell timer={timer}>
          <Waiting label={`${nameOf(state.pendingDebt.debtorId)} is raising money to pay a debt`} />
        </Shell>
      ),
    };
  }

  if (state.phase === 'build' && state.buildOffer) {
    const mine = state.buildOffer.playerId === player.id;
    return {
      key: `build-${mine}-${state.buildOffer.tile}`,
      node: mine ? (
        <Shell timer={timer} tone="gold">
          <BuildPanel state={state} me={player} />
        </Shell>
      ) : (
        <Shell timer={timer}>
          <Waiting
            label={`${nameOf(state.buildOffer.playerId)} is deciding what to build in ${tileAt(state.buildOffer.tile).name}`}
          />
        </Shell>
      ),
    };
  }

  if (state.phase === 'buyout' && state.buyoutOffer) {
    const mine = state.buyoutOffer.playerId === player.id;
    return {
      key: `buyout-${mine}-${state.buyoutOffer.tile}`,
      node: mine ? (
        <Shell timer={timer} tone="gold">
          <BuyoutPanel state={state} me={player} />
        </Shell>
      ) : (
        <Shell timer={timer}>
          <Waiting
            label={`${nameOf(state.buyoutOffer.playerId)} is weighing a buyout of ${tileAt(state.buyoutOffer.tile).name}`}
          />
        </Shell>
      ),
    };
  }

  if (state.phase === 'championship' && state.championshipOffer) {
    const mine = state.championshipOffer.playerId === player.id;
    return {
      key: `championship-${mine}`,
      node: mine ? (
        <Shell timer={timer} tone="gold">
          <ChampionshipPanel state={state} me={player} />
        </Shell>
      ) : (
        <Shell timer={timer}>
          <Waiting label={`${nameOf(state.championshipOffer.playerId)} is choosing a championship city`} />
        </Shell>
      ),
    };
  }

  const currentId = state.order[state.currentIndex];
  if (currentId !== player.id) {
    return {
      key: `waiting-${currentId}`,
      node: (
        <Shell timer={timer}>
          <Waiting label={`${nameOf(currentId)} is taking their turn`} />
          <button type="button" className="btn-ghost" onClick={onOpenPortfolio}>
            My cities
          </button>
        </Shell>
      ),
    };
  }

  return {
    key: `my-turn-${state.rollId}`,
    node: <MyTurn state={state} me={player} onOpenPortfolio={onOpenPortfolio} onOpenTrade={onOpenTrade} timer={timer} />,
  };
}

function MyTurn({
  state,
  me,
  onOpenPortfolio,
  onOpenTrade,
  timer,
}: {
  state: GameState;
  me: Player;
  onOpenPortfolio: () => void;
  onOpenTrade: () => void;
  timer: { seconds: number; total: number };
}) {
  const act = useActions();
  const destinations = travelDestinations(state, me);
  const ticket = state.settings.worldTourFee;
  const canFly = me.travelPending && me.cash >= ticket && destinations.length > 0;

  return (
    <Shell timer={timer}>
      <div className="flex min-w-[12rem] flex-1 flex-col gap-0.5">
        <span className="font-display text-xl font-semibold text-sky-600">Your turn</span>
        <span className="text-sm text-slate-600">
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
            className="field w-auto py-2.5 pr-9 text-base"
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
        <button
          type="button"
          className="btn-primary min-w-[9.5rem] animate-pulse-ring px-6 text-lg"
          onClick={() => act({ type: 'roll' })}
        >
          {me.onIsland ? 'Roll for doubles' : canFly ? 'Roll instead' : 'Roll dice'}
        </button>
      </div>
    </Shell>
  );
}
