import { useEffect, useRef } from 'react';
import {
  BUYOUT_MULTIPLIER,
  GROUPS,
  HOTEL_LEVEL,
  RESORT_RENT,
  TILE_ACCENT,
  championshipMultiplier,
  formatCompact,
  groupMembers,
  playerHoldings,
  propertyValue,
  rentFor,
  tileAt,
} from '@shared';
import type { GameState, GroupId } from '@shared';
import { drawFlag } from '../lib/flags';
import { Avatar, Stat } from './atoms';

const DESCRIPTIONS: Record<string, string> = {
  start: 'Collect your salary every time you pass or land here.',
  island: 'Stranded for up to three turns. Roll doubles, pay for a boat, or play an escape card.',
  championship: 'Host a championship in one of your cities to multiply its rent. Every new one is bigger.',
  worldtour: 'On your next turn, fly to any empty city or resort, or one of your own, for a ticket fee.',
  chance: 'Draw a Chance card. It may help you or hurt you.',
  tax: 'Pay ten percent of everything you have built.',
};

/** The same flag the board draws on the city's band, at card size. */
function Flag({ group }: { group: GroupId }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(3, 0, 0, 3, 0, 0);
    drawFlag(ctx, group, 0, 0, 36, 24);
  }, [group]);
  return (
    <canvas
      ref={ref}
      width={108}
      height={72}
      className="h-8 w-12 shrink-0 rounded-md shadow-sm ring-2 ring-white/80"
      aria-hidden
    />
  );
}

function levelName(level: number): string {
  return level >= HOTEL_LEVEL ? 'Hotel' : `${level} house${level > 1 ? 's' : ''}`;
}

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
      ? `${GROUPS[tile.group].label} · ${groupMembers(tile.group).length} cities`
      : tile.kind === 'resort'
        ? 'Resort'
        : 'Special space';
  const ownable = tile.kind === 'city' || tile.kind === 'resort';
  const resortsHeld = owner
    ? playerHoldings(state, owner.id).filter((i) => tileAt(i).kind === 'resort').length
    : 0;

  return (
    <div className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white">
      <div
        className="flex items-center gap-3.5 px-5 py-4"
        style={{ background: `linear-gradient(135deg, ${accent}, ${accent}80)` }}
      >
        {tile.kind === 'city' && <Flag group={tile.group} />}
        <div className="min-w-0">
          <div className="text-xs font-extrabold uppercase tracking-[0.16em] text-ink-950/70">{kicker}</div>
          <div className="font-display text-3xl font-bold leading-tight text-ink-950">{tile.name}</div>
        </div>
      </div>

      <div className="space-y-4 px-5 py-5 text-base">
        {ownable &&
          (owner ? (
            <div className="flex flex-wrap items-center gap-3">
              <Avatar player={owner} size={40} />
              <span className="text-slate-700">
                Owned by <span className="font-bold text-slate-900">{owner.name}</span>
              </span>
              <span className="ml-auto rounded-full bg-slate-900 px-3.5 py-1 font-display text-lg font-semibold tabular-nums text-white">
                Rent {formatCompact(rentFor(state, index))}
              </span>
            </div>
          ) : (
            <p className="rounded-xl bg-slate-50 px-4 py-3 text-slate-600">Unclaimed. Land here to buy it.</p>
          ))}

        {multiplier > 1 && (
          <div className="rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 font-semibold text-amber-800">
            Championship city: rent x{multiplier}
          </div>
        )}

        {tile.kind === 'city' && (
          <>
            <section>
              <h3 className="label mb-2">Rent{multiplier > 1 ? ` (x${multiplier})` : ''}</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {tile.rent.map((rent, i) => {
                  const level = i + 1;
                  const current = !!holding?.owner && holding.level === level;
                  return (
                    <Stat
                      key={level}
                      label={
                        <span className="flex items-center justify-between gap-1">
                          {levelName(level)}
                          {current && (
                            <span className="rounded-full bg-sky-500 px-1.5 text-xs leading-5 text-white">
                              Now
                            </span>
                          )}
                        </span>
                      }
                      value={formatCompact(rent * multiplier)}
                      tone={current ? 'active' : level >= HOTEL_LEVEL ? 'gold' : 'default'}
                    />
                  );
                })}
              </div>
            </section>
            <section>
              <h3 className="label mb-2">Building costs</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Stat label="Each house" value={formatCompact(tile.houseCost)} />
                <Stat label="Hotel" value={formatCompact(tile.hotelCost)} />
                {holding?.owner && holding.level < HOTEL_LEVEL && (
                  <Stat
                    label={`Buyout (x${BUYOUT_MULTIPLIER})`}
                    value={formatCompact(propertyValue(state, index) * BUYOUT_MULTIPLIER)}
                  />
                )}
              </div>
            </section>
            <p className="text-sm leading-relaxed text-slate-500">
              Two houses on your first lap, a third after you pass Start, then a hotel (replacing three houses) on a
              later visit. A hotel cannot be bought out or shaken by an earthquake.
            </p>
          </>
        )}

        {tile.kind === 'resort' && (
          <>
            <section>
              <h3 className="label mb-2">Rent by resorts owned</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {RESORT_RENT.map((rent, i) => (
                  <Stat
                    key={rent}
                    label={`${i + 1} resort${i ? 's' : ''}`}
                    value={formatCompact(rent)}
                    tone={resortsHeld === i + 1 ? 'active' : 'default'}
                  />
                ))}
                <Stat label="All four" value="Instant win" tone="gold" />
              </div>
            </section>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Stat label="Price" value={formatCompact(tile.price)} />
            </div>
            <p className="text-sm leading-relaxed text-slate-500">Resorts can never be bought out.</p>
          </>
        )}

        {DESCRIPTIONS[tile.kind] && <p className="text-lg leading-relaxed text-slate-700">{DESCRIPTIONS[tile.kind]}</p>}
      </div>
    </div>
  );
}
