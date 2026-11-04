import {
  BUYOUT_MULTIPLIER,
  GROUPS,
  HOTEL_LEVEL,
  RESORT_RENT,
  TILE_ACCENT,
  championshipMultiplier,
  formatCompact,
  groupMembers,
  propertyValue,
  rentFor,
  tileAt,
} from '@shared';
import type { GameState } from '@shared';
import { cx } from '../lib/format';
import { Avatar } from './atoms';

const DESCRIPTIONS: Record<string, string> = {
  start: 'Collect your salary every time you pass or land here.',
  island: 'Stranded for up to three turns. Roll doubles, pay for a boat, or play an escape card.',
  championship: 'Host a championship in one of your cities to multiply its rent. Every new one is bigger.',
  worldtour: 'On your next turn, fly to any empty city or resort, or one of your own, for a ticket fee.',
  chance: 'Draw a Chance card. It may help you or hurt you.',
  tax: 'Pay ten percent of everything you have built.',
};

/** The deed: what it costs, what it earns at each level, and who holds it. */
export function PropertyCard({ state, index }: { state: GameState; index: number }) {
  const tile = tileAt(index);
  const holding = state.holdings[index];
  const owner = holding?.owner ? state.players.find((p) => p.id === holding.owner) : null;
  const multiplier = championshipMultiplier(state, index);
  const accent =
    tile.kind === 'city' ? GROUPS[tile.group].color : tile.kind === 'resort' ? TILE_ACCENT.resort : '#64748b';
  const kicker =
    tile.kind === 'city'
      ? `${GROUPS[tile.group].label} - ${groupMembers(tile.group).length} cities`
      : tile.kind === 'resort'
        ? 'Resort'
        : 'Special space';

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="px-4 py-3" style={{ background: `linear-gradient(135deg, ${accent}, ${accent}77)` }}>
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-950/70">{kicker}</div>
        <div className="font-display text-lg font-bold text-ink-950">{tile.name}</div>
      </div>

      <div className="space-y-2.5 px-4 py-3 text-[13px]">
        {(tile.kind === 'city' || tile.kind === 'resort') &&
          (owner ? (
            <div className="flex items-center gap-2">
              <Avatar player={owner} size={26} />
              <span className="text-slate-700">
                Owned by <span className="font-semibold text-slate-900">{owner.name}</span>
              </span>
              <span className="ml-auto font-mono text-slate-800">rent {formatCompact(rentFor(state, index))}</span>
            </div>
          ) : (
            <div className="text-slate-500">Unclaimed - land here to buy it.</div>
          ))}

        {multiplier > 1 && (
          <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-amber-700">
            Championship city - rent x{multiplier}
          </div>
        )}

        {tile.kind === 'city' && (
          <>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
              {tile.rent.map((rent, i) => {
                const level = i + 1;
                return (
                  <div
                    key={level}
                    className={cx(
                      'flex items-center justify-between px-1 py-1 text-[12.5px]',
                      holding?.owner && holding.level === level && 'rounded-lg bg-neon-cyan/12 font-semibold text-neon-cyan',
                    )}
                  >
                    <span className="text-slate-500">
                      {level >= HOTEL_LEVEL ? 'Hotel' : `${level} house${level > 1 ? 's' : ''}`}
                    </span>
                    <span className="font-mono text-slate-800">{formatCompact(rent * multiplier)}</span>
                  </div>
                );
              })}
            </div>
            <Row label="Each house" value={formatCompact(tile.houseCost)} />
            <Row label="Hotel (after three houses)" value={formatCompact(tile.hotelCost)} />
            {holding?.owner && holding.level < HOTEL_LEVEL && (
              <Row label={`Buyout price (x${BUYOUT_MULTIPLIER})`} value={formatCompact(propertyValue(state, index) * BUYOUT_MULTIPLIER)} />
            )}
            <p className="text-[11.5px] text-slate-500">
              Two houses on your first lap, a third after you pass Start, then a hotel on a later visit. A hotel
              cannot be bought out or shaken by an earthquake.
            </p>
          </>
        )}

        {tile.kind === 'resort' && (
          <>
            <Row label="Price" value={formatCompact(tile.price)} />
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
              {RESORT_RENT.map((rent, i) => (
                <div key={rent} className="flex items-center justify-between px-1 py-1 text-[12.5px]">
                  <span className="text-slate-500">{i + 1} resort{i ? 's' : ''} owned</span>
                  <span className="font-mono text-slate-800">{formatCompact(rent)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between px-1 py-1 text-[12.5px] font-semibold text-neon-gold">
                <span>All four</span>
                <span>Instant win</span>
              </div>
            </div>
            <p className="text-[11.5px] text-slate-500">Resorts can never be bought out.</p>
          </>
        )}

        {DESCRIPTIONS[tile.kind] && <p className="text-slate-700">{DESCRIPTIONS[tile.kind]}</p>}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="font-mono text-slate-900">{value}</span>
    </div>
  );
}
