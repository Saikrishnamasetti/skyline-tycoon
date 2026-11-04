import type { ReactNode } from 'react';
import {
  HOTEL_LEVEL,
  championshipMultiplier,
  formatCompact,
  liquidValue,
  playerHoldings,
  rentFor,
  tileAt,
} from '@shared';
import type { GameState, Player } from '@shared';
import { cx } from '../lib/format';
import { useActions } from '../hooks/useActions';
import { Money, TimerRing } from './atoms';

export function Shell({
  children,
  timer,
  tone = 'default',
}: {
  children: ReactNode;
  timer?: { seconds: number; total: number };
  tone?: 'default' | 'gold' | 'danger';
}) {
  return (
    <div
      className={cx(
        'panel flex flex-wrap items-center gap-3 px-4 py-3 sm:gap-4 sm:px-5 sm:py-3.5',
        tone === 'gold' && 'border-amber-300',
        tone === 'danger' && 'border-rose-300',
      )}
    >
      {timer && timer.seconds > 0 && <TimerRing seconds={timer.seconds} total={timer.total} size={48} />}
      {children}
    </div>
  );
}

export function Waiting({ label }: { label: string }) {
  return (
    <div className="flex flex-1 items-center gap-3 text-base font-semibold text-slate-600" role="status">
      <span className="flex gap-1.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-2 w-2 rounded-full bg-sky-500/80"
            style={{ animation: `float 1.2s ease-in-out ${i * 0.15}s infinite` }}
          />
        ))}
      </span>
      {label}
    </div>
  );
}

function Heading({ title, detail }: { title: ReactNode; detail?: ReactNode }) {
  return (
    <div className="flex min-w-[12rem] flex-1 flex-col gap-0.5">
      <span className="font-display text-lg font-semibold leading-snug text-slate-900">{title}</span>
      {detail && <span className="text-sm text-slate-600">{detail}</span>}
    </div>
  );
}

function levelLabel(level: number, resort: boolean): string {
  if (resort) return 'Buy resort';
  if (level >= HOTEL_LEVEL) return 'Hotel';
  return `${level} house${level > 1 ? 's' : ''}`;
}

/** Buy a city or resort, or add to one you own. */
export function BuildPanel({ state, me }: { state: GameState; me: Player }) {
  const act = useActions();
  const offer = state.buildOffer!;
  const tile = tileAt(offer.tile);
  const resort = tile.kind === 'resort';
  const firstLap = me.laps < 1 && !resort && offer.currentLevel < 2;

  return (
    <>
      <Heading
        title={offer.mode === 'buy' ? `${tile.name} is up for grabs` : `Build up ${tile.name}`}
        detail={
          <>
            You hold <Money amount={me.cash} />
            {firstLap ? ' - a third house unlocks after your first lap' : ''}
          </>
        }
      />
      <div className="flex flex-wrap gap-2">
        {offer.options.map((option) => {
          const rent =
            tile.kind === 'city'
              ? tile.rent[Math.min(option.level, HOTEL_LEVEL) - 1] * championshipMultiplier(state, offer.tile)
              : null;
          return (
            <button
              key={option.level}
              type="button"
              className="btn-gold flex-col gap-0 px-4 py-2"
              disabled={option.cost > me.cash}
              onClick={() => act({ type: 'build', level: option.level })}
            >
              <span>
                {levelLabel(option.level, resort)} - {formatCompact(option.cost)}
              </span>
              {rent !== null && (
                <span className="text-caption font-semibold opacity-80">rent {formatCompact(rent)}</span>
              )}
            </button>
          );
        })}
        <button type="button" className="btn-ghost" onClick={() => act({ type: 'skipBuild' })}>
          Skip
        </button>
      </div>
    </>
  );
}

export function BuyoutPanel({ state, me }: { state: GameState; me: Player }) {
  const act = useActions();
  const offer = state.buyoutOffer!;
  const owner = state.players.find((p) => p.id === offer.fromId);
  return (
    <>
      <Heading
        title={`Buy ${tileAt(offer.tile).name} from ${owner?.name ?? 'its owner'}?`}
        detail={
          <>
            Twice what was built on it. Rent here is {formatCompact(rentFor(state, offer.tile))}. You hold{' '}
            <Money amount={me.cash} />
          </>
        }
      />
      <div className="flex gap-2">
        <button type="button" className="btn-gold" disabled={offer.price > me.cash} onClick={() => act({ type: 'buyout' })}>
          Buy out - {formatCompact(offer.price)}
        </button>
        <button type="button" className="btn-ghost" onClick={() => act({ type: 'skipBuyout' })}>
          No thanks
        </button>
      </div>
    </>
  );
}

export function ChampionshipPanel({ state, me }: { state: GameState; me: Player }) {
  const act = useActions();
  const next = 2 + state.championship.level;
  const cities = playerHoldings(state, me.id).filter((i) => tileAt(i).kind === 'city');
  return (
    <>
      <Heading
        title="Host the championship"
        detail={`Tap a glowing city on the board, or pick one here. Its rent becomes x${next}.`}
      />
      <div className="flex flex-wrap gap-1.5">
        {cities.map((index) => (
          <button
            key={index}
            type="button"
            className="btn-gold btn-sm"
            onClick={() => act({ type: 'hostChampionship', tile: index })}
          >
            {tileAt(index).name}
          </button>
        ))}
        <button type="button" className="btn-ghost btn-sm" onClick={() => act({ type: 'skipChampionship' })}>
          Skip
        </button>
      </div>
    </>
  );
}

export function DebtPanel({
  state,
  me,
  onOpenPortfolio,
}: {
  state: GameState;
  me: Player;
  onOpenPortfolio: () => void;
}) {
  const act = useActions();
  const debt = state.pendingDebt!;
  const canCover = me.cash >= debt.amount;
  const couldRaise = liquidValue(state, me.id) >= debt.amount;
  return (
    <>
      <div className="flex min-w-[12rem] flex-1 flex-col gap-0.5">
        <span className="font-display text-lg font-semibold text-rose-700">
          You owe {formatCompact(debt.amount)}
        </span>
        <span className="text-sm text-slate-600">
          {debt.reason}. You hold <Money amount={me.cash} />.
          {!canCover && couldRaise ? ' Sell properties to the bank at half value.' : ''}
          {!couldRaise ? ' Even selling everything will not cover it.' : ''}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-ghost" onClick={onOpenPortfolio}>
          Sell property
        </button>
        <button type="button" className="btn-primary" disabled={!canCover} onClick={() => act({ type: 'settleDebt' })}>
          Pay {formatCompact(debt.amount)}
        </button>
        <button type="button" className="btn-danger" onClick={() => act({ type: 'declareBankruptcy' })}>
          Go bankrupt
        </button>
      </div>
    </>
  );
}

/** World Tour: every valid destination, cheapest first. */
export function travelDestinations(state: GameState, me: Player): number[] {
  if (!me.travelPending) return [];
  return Object.keys(state.holdings)
    .map(Number)
    .filter((i) => {
      const owner = state.holdings[i].owner;
      return i !== me.position && (!owner || owner === me.id);
    })
    .sort((a, b) => a - b);
}
