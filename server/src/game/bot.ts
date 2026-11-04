import {
  CITY_INDEXES,
  OWNABLE_INDEXES,
  RESORT_INDEXES,
  buildOptions,
  completedGroups,
  findPlayer,
  playerHoldings,
  rentFor,
  resortCount,
  sellValue,
  tileAt,
} from '../shared';
import type { GameAction, GameState } from '../shared';

/** Cash a bot tries to keep in hand for rent it might owe. */
const RESERVE = 150_000;

/**
 * The move a bot wants to make right now, or null if it has nothing to do.
 * Bots go through Game.dispatch exactly like people, so they are held to the
 * same rules and cannot do anything a human could not.
 */
export function botDecision(state: GameState, botId: string): GameAction | null {
  if (!findPlayer(state, botId)?.isBot) return null;
  return decideMove(state, botId);
}

/**
 * The same policy without the bot check, so tests can drive human seats
 * through the real socket layer with sensible play.
 */
export function decideMove(state: GameState, botId: string): GameAction | null {
  const bot = findPlayer(state, botId);
  if (!bot || bot.bankrupt || state.status !== 'playing') return null;

  const debt = state.pendingDebt;
  if (debt?.debtorId === botId) {
    if (bot.cash >= debt.amount) return { type: 'settleDebt' };
    const cheapest = playerHoldings(state, botId).sort(
      (a, b) => sellValue(state, a) - sellValue(state, b),
    )[0];
    return cheapest !== undefined
      ? { type: 'sellProperty', tile: cheapest }
      : { type: 'declareBankruptcy' };
  }

  const build = state.buildOffer;
  if (build?.playerId === botId) {
    const affordable = build.options.filter((o) => o.cost <= bot.cash - RESERVE);
    const choice = affordable[affordable.length - 1];
    return choice ? { type: 'build', level: choice.level } : { type: 'skipBuild' };
  }

  const buyout = state.buyoutOffer;
  if (buyout?.playerId === botId) {
    const tile = tileAt(buyout.tile);
    // Worth it when it is cheap relative to cash, or it finishes a country.
    const finishesCountry =
      tile.kind === 'city' &&
      CITY_INDEXES.filter((i) => {
        const t = tileAt(i);
        return t.kind === 'city' && t.group === tile.group && i !== buyout.tile;
      }).every((i) => state.holdings[i]?.owner === botId);
    const affordable = buyout.price <= bot.cash - RESERVE * 2;
    return affordable && (finishesCountry || buyout.price <= bot.cash * 0.4)
      ? { type: 'buyout' }
      : { type: 'skipBuyout' };
  }

  if (state.championshipOffer?.playerId === botId) {
    const best = playerHoldings(state, botId)
      .filter((i) => tileAt(i).kind === 'city')
      .sort((a, b) => rentFor(state, b) - rentFor(state, a))[0];
    return best !== undefined
      ? { type: 'hostChampionship', tile: best }
      : { type: 'skipChampionship' };
  }

  const incoming = state.trades.find((t) => t.status === 'open' && t.toId === botId);
  if (incoming) return { type: 'respondTrade', tradeId: incoming.id, accept: false };

  const currentId = state.order[state.currentIndex];
  if (currentId !== botId || state.phase !== 'pre_roll') return null;

  if (bot.onIsland) {
    if (bot.escapeCards > 0) return { type: 'useEscape' };
    if (bot.cash > state.settings.islandFee * 4) return { type: 'payIslandFee' };
    return { type: 'roll' };
  }

  if (bot.travelPending && bot.cash > state.settings.worldTourFee + RESERVE) {
    const destination = pickFlight(state, botId);
    if (destination !== null) return { type: 'travel', tile: destination };
  }
  return { type: 'roll' };
}

/** Prefer a resort when collecting them, then the priciest city it can claim. */
function pickFlight(state: GameState, botId: string): number | null {
  const bot = findPlayer(state, botId)!;
  const budget = bot.cash - state.settings.worldTourFee - RESERVE;
  const candidates = OWNABLE_INDEXES.filter((i) => {
    if (i === bot.position) return false;
    const owner = state.holdings[i]?.owner;
    if (owner && owner !== botId) return false;
    const options = buildOptions(state, botId, i);
    return options.length > 0 && options[0].cost <= budget;
  });
  if (candidates.length === 0) return null;
  if (resortCount(state, botId) >= 2) {
    const resort = candidates.find((i) => RESORT_INDEXES.includes(i));
    if (resort !== undefined) return resort;
  }
  const groupsOwned = completedGroups(state, botId);
  return candidates.sort((a, b) => score(state, b, groupsOwned) - score(state, a, groupsOwned))[0];
}

function score(state: GameState, index: number, owned: string[]): number {
  const tile = tileAt(index);
  if (tile.kind === 'resort') return tile.price;
  if (tile.kind !== 'city') return 0;
  return tile.houseCost * (owned.includes(tile.group) ? 0.5 : 1);
}
