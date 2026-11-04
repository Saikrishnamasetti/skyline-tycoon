import { BOARD, BOARD_SIZE, RESORT_INDEXES, RESORT_RENT, SIDES } from './board';
import {
  BUYOUT_MULTIPLIER,
  FIRST_LAP_HOUSES,
  HOTEL_LEVEL,
  MAX_HOUSES,
  SELL_RATE,
  TAX_RATE,
} from './constants';
import type {
  BuildOption,
  CityTile,
  GameState,
  GroupId,
  OwnableTile,
  Player,
  Tile,
  WinReason,
} from './types';

/* ------------------------------------------------------------ predicates */

export const isOwnable = (t: Tile): t is OwnableTile => t.kind === 'city' || t.kind === 'resort';
export const isCity = (t: Tile): t is CityTile => t.kind === 'city';

export const OWNABLE_INDEXES: number[] = BOARD.filter(isOwnable).map((t) => t.index);
export const CITY_INDEXES: number[] = BOARD.filter(isCity).map((t) => t.index);

export function tileAt(index: number): Tile {
  return BOARD[((index % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE];
}

export function groupMembers(group: GroupId): number[] {
  return BOARD.filter((t) => t.kind === 'city' && t.group === group).map((t) => t.index);
}

/* --------------------------------------------------------------- lookups */

export function findPlayer(state: GameState, id: string): Player | undefined {
  return state.players.find((p) => p.id === id);
}

export function currentPlayerId(state: GameState): string | null {
  return state.order[state.currentIndex] ?? null;
}

export function ownerOf(state: GameState, index: number): string | null {
  return state.holdings[index]?.owner ?? null;
}

export function playerHoldings(state: GameState, playerId: string): number[] {
  return OWNABLE_INDEXES.filter((i) => state.holdings[i]?.owner === playerId);
}

export function activePlayers(state: GameState): Player[] {
  return state.players.filter((p) => !p.bankrupt);
}

/* ---------------------------------------------------------------- values */

/** Everything spent on a city to reach a building level. */
export function cityInvested(tile: CityTile, level: number): number {
  const houses = Math.min(level, MAX_HOUSES) * tile.houseCost;
  return level >= HOTEL_LEVEL ? houses + tile.hotelCost : houses;
}

/** What a holding is worth: the build cost of a city, the price of a resort. */
export function propertyValue(state: GameState, index: number): number {
  const tile = tileAt(index);
  const holding = state.holdings[index];
  if (!holding || !holding.owner) return 0;
  if (tile.kind === 'city') return cityInvested(tile, holding.level);
  if (tile.kind === 'resort') return tile.price;
  return 0;
}

export function sellValue(state: GameState, index: number): number {
  return Math.floor(propertyValue(state, index) * SELL_RATE);
}

export function championshipMultiplier(state: GameState, index: number): number {
  return state.championship.tile === index ? 1 + state.championship.level : 1;
}

export function resortCount(state: GameState, playerId: string): number {
  return RESORT_INDEXES.filter((i) => state.holdings[i]?.owner === playerId).length;
}

export function rentFor(state: GameState, index: number): number {
  const tile = tileAt(index);
  const holding = state.holdings[index];
  if (!holding || !holding.owner) return 0;
  if (tile.kind === 'city') {
    if (holding.level < 1) return 0;
    const base = tile.rent[Math.min(holding.level, HOTEL_LEVEL) - 1];
    return base * championshipMultiplier(state, index);
  }
  if (tile.kind === 'resort') {
    const owned = resortCount(state, holding.owner);
    return RESORT_RENT[Math.min(owned, RESORT_RENT.length) - 1] ?? 0;
  }
  return 0;
}

export function netWorth(state: GameState, playerId: string): number {
  const player = findPlayer(state, playerId);
  if (!player) return 0;
  return playerHoldings(state, playerId).reduce(
    (sum, i) => sum + propertyValue(state, i),
    player.cash,
  );
}

/** The most cash a player could raise right now by selling to the bank. */
export function liquidValue(state: GameState, playerId: string): number {
  const player = findPlayer(state, playerId);
  if (!player) return 0;
  return playerHoldings(state, playerId).reduce((sum, i) => sum + sellValue(state, i), player.cash);
}

export function taxDue(state: GameState, playerId: string): number {
  const built = playerHoldings(state, playerId).reduce(
    (sum, i) => sum + propertyValue(state, i),
    0,
  );
  return Math.floor((built * TAX_RATE) / 1000) * 1000;
}

/* -------------------------------------------------------------- building */

export interface RuleCheck {
  ok: boolean;
  reason?: string;
  cost: number;
}

/** Houses a player may have on one city: two until they have done a lap. */
export function houseCap(player: Pick<Player, 'laps'>): number {
  return player.laps >= 1 ? MAX_HOUSES : FIRST_LAP_HOUSES;
}

/**
 * The building choices a player has when standing on a city or resort.
 * Unowned city: one house up to the cap. Own city: more houses up to the cap,
 * or a hotel once three houses stand. Unowned resort: buy it.
 * Affordability is not filtered here; the UI greys out, the server refuses.
 */
export function buildOptions(state: GameState, playerId: string, index: number): BuildOption[] {
  const tile = tileAt(index);
  const holding = state.holdings[index];
  const player = findPlayer(state, playerId);
  if (!player || !holding) return [];

  if (tile.kind === 'resort') {
    return holding.owner ? [] : [{ level: 1, cost: tile.price }];
  }
  if (tile.kind !== 'city') return [];
  if (holding.owner && holding.owner !== playerId) return [];

  const current = holding.owner ? holding.level : 0;
  if (current >= HOTEL_LEVEL) return [];
  if (current === MAX_HOUSES) return [{ level: HOTEL_LEVEL, cost: tile.hotelCost }];

  const cap = houseCap(player);
  const options: BuildOption[] = [];
  for (let level = current + 1; level <= cap; level++) {
    options.push({ level, cost: (level - current) * tile.houseCost });
  }
  return options;
}

export function buyoutPrice(state: GameState, index: number): number {
  return propertyValue(state, index) * BUYOUT_MULTIPLIER;
}

/** Resorts and hotels can never be bought out. */
export function canBuyout(state: GameState, playerId: string, index: number): RuleCheck {
  const tile = tileAt(index);
  const holding = state.holdings[index];
  const price = buyoutPrice(state, index);
  const player = findPlayer(state, playerId);
  if (tile.kind !== 'city') return { ok: false, reason: 'Only cities can be bought out', cost: price };
  if (!holding?.owner || holding.owner === playerId)
    return { ok: false, reason: 'Nothing to buy out', cost: price };
  if (holding.level >= HOTEL_LEVEL)
    return { ok: false, reason: 'A hotel cannot be bought out', cost: price };
  if (!player || player.cash < price) return { ok: false, reason: 'Not enough cash', cost: price };
  return { ok: true, cost: price };
}

/* ----------------------------------------------------------- monopolies */

export function ownsWholeGroup(state: GameState, playerId: string, group: GroupId): boolean {
  return groupMembers(group).every((i) => state.holdings[i]?.owner === playerId);
}

export function completedGroups(state: GameState, playerId: string): GroupId[] {
  const groups = new Set<GroupId>();
  for (const t of BOARD) {
    if (t.kind === 'city' && ownsWholeGroup(state, playerId, t.group)) groups.add(t.group);
  }
  return [...groups];
}

export interface MonopolyProgress {
  /** Most cities owned on any single side, out of five. */
  side: number;
  /** Countries fully owned, out of the three needed. */
  triple: number;
  /** Resorts owned, out of four. */
  resort: number;
}

export function monopolyProgress(state: GameState, playerId: string): MonopolyProgress {
  const side = Math.max(
    ...SIDES.map((cities) => cities.filter((i) => state.holdings[i]?.owner === playerId).length),
  );
  return {
    side,
    triple: completedGroups(state, playerId).length,
    resort: resortCount(state, playerId),
  };
}

/** Any of the three instant wins this player has just completed. */
export function winCheck(state: GameState, playerId: string): WinReason | null {
  if (resortCount(state, playerId) === RESORT_INDEXES.length) return 'resort';
  if (completedGroups(state, playerId).length >= 3) return 'triple';
  const ownsSide = SIDES.some((cities) =>
    cities.every((i) => state.holdings[i]?.owner === playerId),
  );
  return ownsSide ? 'side' : null;
}

export const WIN_LABEL: Record<WinReason, string> = {
  side: 'Side Monopoly',
  triple: 'Triple Monopoly',
  resort: 'Resort Monopoly',
  bankruptcy: 'Last tycoon standing',
  time: 'Richest when time ran out',
};

/** Trades (an optional house rule) may move any city or resort as built. */
export function canTransfer(state: GameState, index: number): RuleCheck {
  const tile = tileAt(index);
  if (!isOwnable(tile)) return { ok: false, reason: 'Not tradeable', cost: 0 };
  if (!state.holdings[index]?.owner) return { ok: false, reason: 'Nobody owns it', cost: 0 };
  return { ok: true, cost: 0 };
}

/* ----------------------------------------------------------- formatting */

export function formatMoney(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  return sign + '$' + Math.abs(Math.round(amount)).toLocaleString('en-US');
}

/** $350K, $1.75M - for tile faces and tight UI. */
export function formatCompact(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const value = Math.abs(amount);
  if (value >= 1_000_000) {
    const text = (value / 1_000_000).toFixed(2).replace(/\.?0+$/, '');
    return `${sign}$${text}M`;
  }
  if (value >= 1_000) return `${sign}$${Math.round(value / 1_000)}K`;
  return `${sign}$${value}`;
}
