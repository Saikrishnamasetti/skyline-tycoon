import { useState } from 'react';
import {
  GROUPS,
  HOTEL_LEVEL,
  formatCompact,
  liquidValue,
  monopolyProgress,
  netWorth,
  playerHoldings,
  propertyValue,
  rentFor,
  sellValue,
  tileAt,
} from '@shared';
import type { GameState, Player } from '@shared';
import { cx } from '../lib/format';
import { useActions } from '../hooks/useActions';
import { GroupDot, Modal, Money } from './atoms';
import { PropertyCard } from './PropertyCard';

/**
 * Everything a player owns. In the classic rules there is no mortgaging:
 * the only way to raise money is to sell to the bank at half value, and only
 * while a debt is due.
 */
export function PortfolioPanel({
  open,
  onClose,
  state,
  me,
}: {
  open: boolean;
  onClose: () => void;
  state: GameState;
  me: Player | null;
}) {
  const act = useActions();
  const [inspect, setInspect] = useState<number | null>(null);
  if (!me) return null;

  const holdings = playerHoldings(state, me.id);
  const inDebt = state.pendingDebt?.debtorId === me.id;
  const progress = monopolyProgress(state, me.id);

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={
        <span className="flex flex-wrap items-center gap-2">
          My cities
          <span className="chip">
            Cash <Money amount={me.cash} className="ml-1 text-slate-900" />
          </span>
          <span className="chip">
            Worth <Money amount={netWorth(state, me.id)} className="ml-1 text-slate-900" />
          </span>
          {inDebt && (
            <span className="chip border-rose-400/40 text-rose-700">
              Could raise <Money amount={liquidValue(state, me.id)} className="ml-1" />
            </span>
          )}
        </span>
      }
    >
      <div className="mb-4 grid grid-cols-3 gap-2.5 text-center">
        {[
          ['Side', `${progress.side}/5`, 'every city on one side'],
          ['Triple', `${progress.triple}/3`, 'three whole countries'],
          ['Resort', `${progress.resort}/4`, 'all four resorts'],
        ].map(([label, value, hint]) => (
          <div key={label} className="rounded-2xl border-2 border-slate-200 bg-slate-50 px-3 py-3">
            <div className="font-display text-3xl font-bold text-slate-900">{value}</div>
            <div className="text-caption font-bold uppercase tracking-wider text-slate-600">{label} monopoly</div>
            <div className="text-caption text-slate-500">{hint}</div>
          </div>
        ))}
      </div>

      {(me.escapeCards > 0 || me.shieldCards > 0) && (
        <div className="mb-4 flex flex-wrap gap-2">
          {me.escapeCards > 0 && <span className="chip text-emerald-700">Escape card x{me.escapeCards}</span>}
          {me.shieldCards > 0 && <span className="chip text-sky-700">Rent pass x{me.shieldCards}</span>}
        </div>
      )}

      {holdings.length === 0 ? (
        <p className="py-10 text-center text-base text-slate-500">
          You do not own anything yet. Land on an empty city to claim it.
        </p>
      ) : (
        <div className="space-y-2">
          {holdings.map((index) => {
            const tile = tileAt(index);
            const level = state.holdings[index].level;
            return (
              <div
                key={index}
                className={cx(
                  'flex flex-wrap items-center gap-2.5 rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3',
                  state.championship.tile === index && 'border-amber-300',
                )}
              >
                <GroupDot tile={tile} />
                <button
                  type="button"
                  className="rounded-md font-display text-lg font-semibold text-slate-900 hover:text-sky-700 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-300"
                  onClick={() => setInspect(index)}
                >
                  {tile.name}
                </button>
                <span className="chip">
                  {tile.kind === 'city'
                    ? `${GROUPS[tile.group].label} - ${level >= HOTEL_LEVEL ? 'hotel' : `${level} house${level > 1 ? 's' : ''}`}`
                    : 'Resort'}
                </span>
                {state.championship.tile === index && (
                  <span className="chip border-amber-400/40 text-amber-700">Championship</span>
                )}
                <span className="ml-auto text-sm text-slate-600">
                  rent {formatCompact(rentFor(state, index))} - worth {formatCompact(propertyValue(state, index))}
                </span>
                {inDebt && (
                  <button
                    type="button"
                    className="btn-danger btn-sm"
                    onClick={() => act({ type: 'sellProperty', tile: index })}
                  >
                    Sell +{formatCompact(sellValue(state, index))}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal open={inspect !== null} onClose={() => setInspect(null)} title="Deed">
        {inspect !== null && <PropertyCard state={state} index={inspect} />}
      </Modal>
    </Modal>
  );
}
