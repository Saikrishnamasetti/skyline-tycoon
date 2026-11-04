import { beforeEach, describe, expect, it } from 'vitest';
import { diceQueue, queueDice, resetRandom } from './helpers';
import { Game } from '../game/engine';
import { botDecision } from '../game/bot';
import {
  BOARD,
  DEFAULT_SETTINGS,
  GROUPS,
  OWNABLE_INDEXES,
  RESORT_INDEXES,
  SIDES,
  buildOptions,
  rentFor,
  taxDue,
} from '../shared';
import type { GameSettings, PlayerColorId, TokenShape } from '../shared';

const COLORS: PlayerColorId[] = ['cobalt', 'coral', 'mint', 'amber'];
const TOKENS: TokenShape[] = ['tower', 'spire', 'dome', 'prism'];
const START = DEFAULT_SETTINGS.startingCash;

function seatPlayers(count: number, settings?: Partial<GameSettings>) {
  const game = Game.create('TEST01', settings);
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const added = game.addPlayer({ name: `P${i + 1}`, color: COLORS[i], token: TOKENS[i] });
    expect(added.ok).toBe(true);
    ids.push(added.playerId!);
  }
  return { game, ids };
}

function startedGame(count: number, settings?: Partial<GameSettings>) {
  const { game, ids } = seatPlayers(count, settings);
  ids.slice(1).forEach((id) => game.setReady(id, true));
  expect(game.start(ids[0]).ok).toBe(true);
  return { game, ids, p: (i: number) => game.state.players[i] };
}

/** Hand a holding to a player directly, for setting up a scenario. */
function give(game: Game, playerId: string, index: number, level = 1) {
  game.state.holdings[index] = { owner: playerId, level };
}

/** Put the turn back on a player as if their next turn had come round. */
function turnTo(game: Game, seat: number) {
  game.state.currentIndex = seat;
  game.state.phase = 'pre_roll';
}

beforeEach(() => resetRandom());

/* ------------------------------------------------------------------ board */

describe('board', () => {
  it('has 32 spaces with the four corners in place', () => {
    expect(BOARD).toHaveLength(32);
    expect(BOARD[0].kind).toBe('start');
    expect(BOARD[8].kind).toBe('island');
    expect(BOARD[16].kind).toBe('championship');
    expect(BOARD[24].kind).toBe('worldtour');
  });

  it('holds 20 cities in 8 countries of two or three, 4 resorts, 3 Chance and a tax office', () => {
    const count = (kind: string) => BOARD.filter((t) => t.kind === kind).length;
    expect(count('city')).toBe(20);
    expect(count('resort')).toBe(4);
    expect(count('chance')).toBe(3);
    expect(count('tax')).toBe(1);
    for (const group of Object.keys(GROUPS)) {
      const size = BOARD.filter((t) => t.kind === 'city' && t.group === group).length;
      expect([2, 3]).toContain(size);
    }
  });

  it('puts five cities and one resort on every side', () => {
    expect(SIDES).toHaveLength(4);
    SIDES.forEach((side) => expect(side).toHaveLength(5));
    expect(RESORT_INDEXES.map((i) => Math.floor(i / 8))).toEqual([0, 1, 2, 3]);
  });

  it('gets more expensive clockwise', () => {
    const costs = BOARD.filter((t) => t.kind === 'city').map((t) =>
      t.kind === 'city' ? t.houseCost : 0,
    );
    expect([...costs].sort((a, b) => a - b)).toEqual(costs);
  });
});

/* ------------------------------------------------------------------ lobby */

describe('lobby', () => {
  it('caps a room at four and gives each seat its own colour and piece', () => {
    const { game } = seatPlayers(4);
    expect(game.addPlayer({ name: 'P5', color: 'cobalt', token: 'tower' }).ok).toBe(false);
    expect(new Set(game.state.players.map((p) => p.color)).size).toBe(4);
    expect(new Set(game.state.players.map((p) => p.token)).size).toBe(4);
  });

  it('needs two ready players and the host to start', () => {
    const solo = seatPlayers(1);
    expect(solo.game.start(solo.ids[0]).ok).toBe(false);
    const { game, ids } = seatPlayers(2);
    expect(game.start(ids[0]).error).toMatch(/ready/i);
    game.setReady(ids[1], true);
    expect(game.start(ids[1]).error).toMatch(/host/i);
    expect(game.start(ids[0]).ok).toBe(true);
  });

  it('deals two million and starts the match clock', () => {
    const { game } = startedGame(2);
    expect(game.state.players.every((p) => p.cash === 2_000_000)).toBe(true);
    expect(game.state.endsAt! - game.state.startedAt!).toBe(20 * 60_000);
  });

  it('lets only the host add and remove bots, which are always ready', () => {
    const { game, ids } = seatPlayers(2);
    expect(game.addBot(ids[1]).ok).toBe(false);
    expect(game.addBot(ids[0]).ok).toBe(true);
    const bot = game.state.players.find((p) => p.isBot)!;
    expect(bot.ready).toBe(true);
    expect(bot.name).toMatch(/bot/i);
    expect(game.removeBot(ids[0], bot.id).ok).toBe(true);
    expect(game.removeBot(ids[0], ids[1]).ok).toBe(false);
  });
});

/* ----------------------------------------------------------- turn flow */

describe('turn flow', () => {
  it('refuses a roll from anyone but the current player', () => {
    const { game, ids } = startedGame(2);
    expect(game.dispatch(ids[1], { type: 'roll' }).error).toMatch(/not your turn/i);
    expect(game.dispatch('stranger', { type: 'roll' }).ok).toBe(false);
  });

  it('passes the turn on by itself once nothing is left to decide', () => {
    const { game, ids, p } = startedGame(2);
    queueDice(1, 2); // Chance at 3: the top card is an escape card
    game.dispatch(ids[0], { type: 'roll' });
    expect(p(0).escapeCards).toBe(1);
    expect(game.currentId).toBe(ids[1]);
    expect(game.state.phase).toBe('pre_roll');
  });

  it('gives doubles another roll', () => {
    const { game, ids } = startedGame(2);
    queueDice(1, 1); // Luxor
    game.dispatch(ids[0], { type: 'roll' });
    game.dispatch(ids[0], { type: 'skipBuild' });
    expect(game.currentId).toBe(ids[0]);
    expect(game.state.phase).toBe('pre_roll');
  });

  it('pays the salary for passing Start and counts the lap', () => {
    const { game, ids, p } = startedGame(2);
    p(0).position = 30;
    queueDice(1, 2); // 30 -> 1
    game.dispatch(ids[0], { type: 'roll' });
    expect(p(0).position).toBe(1);
    expect(p(0).laps).toBe(1);
    expect(p(0).cash).toBe(START + 300_000);
  });
});

/* ------------------------------------------------------------- building */

describe('building on landing', () => {
  it('offers one or two houses on an empty city during the first lap', () => {
    const { game, ids } = startedGame(2);
    queueDice(1, 3); // Salvador, $80K a house
    game.dispatch(ids[0], { type: 'roll' });
    expect(game.state.phase).toBe('build');
    expect(game.state.buildOffer!.mode).toBe('buy');
    expect(game.state.buildOffer!.options).toEqual([
      { level: 1, cost: 80_000 },
      { level: 2, cost: 160_000 },
    ]);
    expect(game.dispatch(ids[0], { type: 'build', level: 3 }).ok).toBe(false);
  });

  it('charges for the houses, records the owner and moves on', () => {
    const { game, ids, p } = startedGame(2);
    queueDice(1, 3);
    game.dispatch(ids[0], { type: 'roll' });
    expect(game.dispatch(ids[1], { type: 'build', level: 2 }).ok).toBe(false);
    expect(game.dispatch(ids[0], { type: 'build', level: 2 }).ok).toBe(true);
    expect(game.state.holdings[4]).toEqual({ owner: ids[0], level: 2 });
    expect(p(0).cash).toBe(START - 160_000);
    expect(game.currentId).toBe(ids[1]);
  });

  it('leaves the city unclaimed when the player skips', () => {
    const { game, ids } = startedGame(2);
    queueDice(1, 3);
    game.dispatch(ids[0], { type: 'roll' });
    game.dispatch(ids[0], { type: 'skipBuild' });
    expect(game.state.holdings[4].owner).toBeNull();
    expect(game.currentId).toBe(ids[1]);
  });

  it('unlocks the third house after a lap, and a hotel on the visit after that', () => {
    const { game, ids, p } = startedGame(2);
    give(game, ids[0], 4, 2);
    p(0).laps = 1;
    p(0).position = 1;
    queueDice(1, 2);
    game.dispatch(ids[0], { type: 'roll' });
    expect(game.state.buildOffer!.options).toEqual([{ level: 3, cost: 80_000 }]);
    game.dispatch(ids[0], { type: 'build', level: 3 });

    turnTo(game, 0);
    p(0).position = 1;
    queueDice(1, 2);
    game.dispatch(ids[0], { type: 'roll' });
    expect(game.state.buildOffer!.options).toEqual([{ level: 4, cost: 160_000 }]);
    game.dispatch(ids[0], { type: 'build', level: 4 });
    expect(game.state.holdings[4].level).toBe(4);
  });

  it('refuses a build the player cannot pay for', () => {
    const { game, ids, p } = startedGame(2);
    queueDice(1, 3);
    game.dispatch(ids[0], { type: 'roll' });
    p(0).cash = 100_000;
    expect(game.dispatch(ids[0], { type: 'build', level: 2 }).error).toMatch(/cash/i);
  });

  it('sells a resort as a single purchase', () => {
    const { game, ids } = startedGame(2);
    queueDice(2, 4); // Cancun
    game.dispatch(ids[0], { type: 'roll' });
    expect(game.state.buildOffer!.options).toEqual([{ level: 1, cost: 150_000 }]);
  });
});

/* ------------------------------------------------------------------ rent */

describe('rent', () => {
  it('moves rent from the visitor to the owner', () => {
    const { game, ids, p } = startedGame(2);
    give(game, ids[1], 4, 2); // $120K at two houses
    queueDice(1, 3);
    game.dispatch(ids[0], { type: 'roll' });
    expect(p(0).cash).toBe(START - 120_000);
    expect(p(1).cash).toBe(START + 120_000);
  });

  it('multiplies rent in the championship city', () => {
    const { game, ids } = startedGame(2);
    give(game, ids[1], 4, 2);
    game.state.championship = { tile: 4, level: 1 };
    expect(rentFor(game.state, 4)).toBe(240_000);
    game.state.championship = { tile: 4, level: 2 };
    expect(rentFor(game.state, 4)).toBe(360_000);
  });

  it('charges resort rent by how many resorts the owner holds', () => {
    const { game, ids } = startedGame(2);
    give(game, ids[1], 6);
    expect(rentFor(game.state, 6)).toBe(100_000);
    give(game, ids[1], 11);
    expect(rentFor(game.state, 6)).toBe(250_000);
    give(game, ids[1], 21);
    expect(rentFor(game.state, 6)).toBe(600_000);
  });

  it('lets a diplomatic pass cancel one rent payment', () => {
    const { game, ids, p } = startedGame(2);
    give(game, ids[1], 4, 2);
    p(0).shieldCards = 1;
    queueDice(1, 3);
    game.dispatch(ids[0], { type: 'roll' });
    expect(p(0).cash).toBe(START);
    expect(p(0).shieldCards).toBe(0);
  });
});

/* --------------------------------------------------------------- buyouts */

describe('buyouts', () => {
  it('offers to buy a rival city at twice what was built, after rent is paid', () => {
    const { game, ids, p } = startedGame(2);
    give(game, ids[1], 4, 2); // $160K built
    queueDice(1, 3);
    game.dispatch(ids[0], { type: 'roll' });
    expect(game.state.phase).toBe('buyout');
    expect(game.state.buyoutOffer!.price).toBe(320_000);
    expect(game.dispatch(ids[0], { type: 'buyout' }).ok).toBe(true);
    expect(game.state.holdings[4]).toEqual({ owner: ids[0], level: 2 });
    expect(p(0).cash).toBe(START - 120_000 - 320_000);
    expect(p(1).cash).toBe(START + 120_000 + 320_000);
  });

  it('never offers a buyout on a hotel or a resort', () => {
    const { game, ids } = startedGame(2);
    give(game, ids[1], 4, 4);
    queueDice(1, 3);
    game.dispatch(ids[0], { type: 'roll' });
    expect(game.state.buyoutOffer).toBeNull();

    turnTo(game, 0);
    game.state.players[0].position = 0;
    give(game, ids[1], 6);
    queueDice(2, 4);
    game.dispatch(ids[0], { type: 'roll' });
    expect(game.state.buyoutOffer).toBeNull();
  });

  it('lets the new owner build straight after a buyout', () => {
    const { game, ids, p } = startedGame(2);
    give(game, ids[1], 4, 1);
    queueDice(1, 3);
    game.dispatch(ids[0], { type: 'roll' });
    game.dispatch(ids[0], { type: 'buyout' });
    expect(game.state.phase).toBe('build');
    expect(game.state.buildOffer!.options).toEqual([{ level: 2, cost: 80_000 }]);
    expect(p(0).position).toBe(4);
  });
});

/* ---------------------------------------------------------- championship */

describe('championship', () => {
  it('lets the player host in one of their cities and the multiplier grows each time', () => {
    const { game, ids, p } = startedGame(2);
    give(game, ids[0], 1, 2);
    give(game, ids[0], 2, 1);
    p(0).position = 12;
    queueDice(1, 3);
    game.dispatch(ids[0], { type: 'roll' });
    expect(game.state.phase).toBe('championship');
    expect(game.dispatch(ids[0], { type: 'hostChampionship', tile: 4 }).ok).toBe(false);
    expect(game.dispatch(ids[0], { type: 'hostChampionship', tile: 1 }).ok).toBe(true);
    expect(game.state.championship).toEqual({ tile: 1, level: 1 });
    expect(rentFor(game.state, 1)).toBe(90_000 * 2);

    turnTo(game, 0);
    p(0).position = 12;
    queueDice(1, 3);
    game.dispatch(ids[0], { type: 'roll' });
    game.dispatch(ids[0], { type: 'hostChampionship', tile: 2 });
    expect(game.state.championship).toEqual({ tile: 2, level: 2 });
    expect(rentFor(game.state, 1)).toBe(90_000);
    expect(rentFor(game.state, 2)).toBe(30_000 * 3);
  });

  it('does nothing for a player without a city', () => {
    const { game, ids, p } = startedGame(2);
    p(0).position = 12;
    queueDice(1, 3);
    game.dispatch(ids[0], { type: 'roll' });
    expect(game.state.championshipOffer).toBeNull();
    expect(game.currentId).toBe(ids[1]);
  });
});

/* ---------------------------------------------------------------- island */

describe('the Island', () => {
  it('strands a player who lands on it or rolls three doubles', () => {
    const { game, ids, p } = startedGame(2);
    queueDice(3, 5);
    game.dispatch(ids[0], { type: 'roll' });
    expect(p(0).onIsland).toBe(true);
    expect(game.currentId).toBe(ids[1]);

    const other = startedGame(2);
    queueDice(1, 1, 2, 2, 3, 3);
    other.game.dispatch(other.ids[0], { type: 'roll' });
    other.game.dispatch(other.ids[0], { type: 'skipBuild' });
    other.game.dispatch(other.ids[0], { type: 'roll' });
    other.game.dispatch(other.ids[0], { type: 'skipBuild' });
    other.game.dispatch(other.ids[0], { type: 'roll' });
    expect(other.p(0).onIsland).toBe(true);
    expect(other.p(0).position).toBe(8);
  });

  it('frees a player on doubles without a bonus roll', () => {
    const { game, ids, p } = startedGame(2);
    Object.assign(p(0), { onIsland: true, position: 8 });
    queueDice(2, 2); // Seville
    game.dispatch(ids[0], { type: 'roll' });
    expect(p(0).onIsland).toBe(false);
    expect(p(0).position).toBe(12);
    game.dispatch(ids[0], { type: 'skipBuild' });
    expect(game.currentId).toBe(ids[1]);
  });

  it('rescues a player after three failed rolls', () => {
    const { game, ids, p } = startedGame(2);
    Object.assign(p(0), { onIsland: true, position: 8 });
    for (let attempt = 1; attempt <= 2; attempt++) {
      queueDice(1, 2);
      game.dispatch(ids[0], { type: 'roll' });
      expect(p(0).onIsland).toBe(true);
      expect(p(0).islandTurns).toBe(attempt);
      turnTo(game, 0);
    }
    queueDice(1, 2);
    game.dispatch(ids[0], { type: 'roll' });
    expect(p(0).onIsland).toBe(false);
    expect(p(0).position).toBe(11);
  });

  it('can be left by paying the boat or playing an escape card', () => {
    const { game, ids, p } = startedGame(2);
    Object.assign(p(0), { onIsland: true, position: 8 });
    expect(game.dispatch(ids[0], { type: 'payIslandFee' }).ok).toBe(true);
    expect(p(0).cash).toBe(START - 200_000);
    expect(p(0).onIsland).toBe(false);
    expect(game.state.phase).toBe('pre_roll');

    Object.assign(p(0), { onIsland: true, escapeCards: 1 });
    expect(game.dispatch(ids[0], { type: 'useEscape' }).ok).toBe(true);
    expect(p(0).escapeCards).toBe(0);
    expect(p(0).cash).toBe(START - 200_000);
  });
});

/* ------------------------------------------------------------ world tour */

describe('World Tour', () => {
  function atWorldTour() {
    const ctx = startedGame(2);
    ctx.p(0).position = 20;
    queueDice(1, 3);
    ctx.game.dispatch(ctx.ids[0], { type: 'roll' });
    expect(ctx.p(0).travelPending).toBe(true);
    expect(ctx.game.currentId).toBe(ctx.ids[1]);
    turnTo(ctx.game, 0);
    return ctx;
  }

  it('flies the player to a chosen city for the ticket price', () => {
    const { game, ids, p } = atWorldTour();
    expect(game.dispatch(ids[0], { type: 'travel', tile: 31 }).ok).toBe(true);
    expect(p(0).position).toBe(31);
    expect(p(0).cash).toBe(START - 50_000);
    expect(game.state.buildOffer!.tile).toBe(31);
  });

  it('pays the salary when the flight crosses Start', () => {
    const { game, ids, p } = atWorldTour();
    game.dispatch(ids[0], { type: 'travel', tile: 4 });
    expect(p(0).cash).toBe(START - 50_000 + 300_000);
    expect(p(0).laps).toBe(1);
  });

  it('will not fly to a rival city or a special space', () => {
    const { game, ids } = atWorldTour();
    give(game, ids[1], 31);
    expect(game.dispatch(ids[0], { type: 'travel', tile: 31 }).ok).toBe(false);
    expect(game.dispatch(ids[0], { type: 'travel', tile: 29 }).ok).toBe(false);
  });

  it('gives up the flight if the player rolls instead', () => {
    const { game, ids, p } = atWorldTour();
    queueDice(1, 3);
    game.dispatch(ids[0], { type: 'roll' });
    expect(p(0).travelPending).toBe(false);
    turnTo(game, 0);
    expect(game.dispatch(ids[0], { type: 'travel', tile: 31 }).ok).toBe(false);
  });
});

/* --------------------------------------------------------- tax and cards */

describe('tax and Chance', () => {
  it('takes ten percent of everything the player has built', () => {
    const { game, ids, p } = startedGame(2);
    give(game, ids[0], 31, 1); // $350K
    give(game, ids[0], 6); // $150K
    expect(taxDue(game.state, ids[0])).toBe(50_000);
    p(0).position = 25;
    queueDice(1, 3);
    game.dispatch(ids[0], { type: 'roll' });
    expect(p(0).cash).toBe(START - 50_000);
  });

  it('knocks a house off the most built-up rival city in an earthquake', () => {
    const { game, ids } = startedGame(2);
    give(game, ids[1], 1, 2);
    give(game, ids[1], 2, 1);
    game.state.deck = ['quake', ...game.state.deck.filter((c) => c !== 'quake')];
    queueDice(1, 2);
    game.dispatch(ids[0], { type: 'roll' });
    expect(game.state.holdings[1].level).toBe(1);
    expect(game.state.holdings[2].level).toBe(1);
  });

  it('cannot shake a hotel', () => {
    const { game, ids } = startedGame(2);
    give(game, ids[1], 1, 4);
    game.state.deck = ['quake', ...game.state.deck.filter((c) => c !== 'quake')];
    queueDice(1, 2);
    game.dispatch(ids[0], { type: 'roll' });
    expect(game.state.holdings[1].level).toBe(4);
  });

  it('sends the player to the Island from a Chance card', () => {
    const { game, ids, p } = startedGame(2);
    game.state.deck = ['customs', ...game.state.deck.filter((c) => c !== 'customs')];
    queueDice(1, 2);
    game.dispatch(ids[0], { type: 'roll' });
    expect(p(0).onIsland).toBe(true);
    expect(p(0).position).toBe(8);
  });
});

/* ------------------------------------------------------------- winning */

describe('instant wins', () => {
  it('awards a Resort Monopoly for the fourth resort', () => {
    const { game, ids } = startedGame(2);
    [11, 21, 27].forEach((i) => give(game, ids[0], i));
    queueDice(2, 4);
    game.dispatch(ids[0], { type: 'roll' });
    game.dispatch(ids[0], { type: 'build', level: 1 });
    expect(game.state.status).toBe('finished');
    expect(game.state.winnerId).toBe(ids[0]);
    expect(game.state.winReason).toBe('resort');
  });

  it('awards a Side Monopoly for every city on one side', () => {
    const { game, ids } = startedGame(2);
    [1, 2, 5, 7].forEach((i) => give(game, ids[0], i));
    queueDice(1, 3);
    game.dispatch(ids[0], { type: 'roll' });
    game.dispatch(ids[0], { type: 'build', level: 1 });
    expect(game.state.winReason).toBe('side');
  });

  it('awards a Triple Monopoly for three whole countries', () => {
    const { game, ids, p } = startedGame(2);
    [1, 2, 9, 10, 30].forEach((i) => give(game, ids[0], i));
    p(0).position = 24;
    queueDice(3, 4); // Tokyo completes Japan
    game.dispatch(ids[0], { type: 'roll' });
    game.dispatch(ids[0], { type: 'build', level: 1 });
    expect(game.state.winReason).toBe('triple');
  });

  it('counts a monopoly completed by a buyout', () => {
    const { game, ids } = startedGame(2);
    [1, 2, 5, 7].forEach((i) => give(game, ids[0], i));
    give(game, ids[1], 4, 1);
    queueDice(1, 3);
    game.dispatch(ids[0], { type: 'roll' });
    game.dispatch(ids[0], { type: 'buyout' });
    expect(game.state.winnerId).toBe(ids[0]);
    expect(game.state.winReason).toBe('side');
  });

  it('ends on the richest player when the match clock runs out', () => {
    const { game, ids, p } = startedGame(2);
    p(1).cash = 5_000_000;
    game.state.endsAt = Date.now() - 1;
    queueDice(1, 2);
    game.dispatch(ids[0], { type: 'roll' });
    expect(game.state.status).toBe('finished');
    expect(game.state.winnerId).toBe(ids[1]);
    expect(game.state.winReason).toBe('time');
  });
});

/* ---------------------------------------------------- debt and bankruptcy */

describe('debt', () => {
  it('pauses on a debt the player can sell their way out of', () => {
    const { game, ids, p } = startedGame(2);
    give(game, ids[1], 4, 2);
    give(game, ids[0], 31, 1); // sells for $175K
    p(0).cash = 100_000;
    queueDice(1, 3);
    game.dispatch(ids[0], { type: 'roll' });
    expect(game.state.phase).toBe('in_debt');
    expect(game.dispatch(ids[0], { type: 'settleDebt' }).ok).toBe(false);
    expect(game.dispatch(ids[0], { type: 'sellProperty', tile: 31 }).ok).toBe(true);
    expect(game.state.holdings[31].owner).toBeNull();
    expect(game.dispatch(ids[0], { type: 'settleDebt' }).ok).toBe(true);
    expect(p(0).cash).toBe(100_000 + 175_000 - 120_000);
    expect(p(1).cash).toBe(START + 120_000);
    expect(game.currentId).toBe(ids[1]);
  });

  it('only lets players sell to cover a debt', () => {
    const { game, ids } = startedGame(2);
    give(game, ids[0], 31, 1);
    expect(game.dispatch(ids[0], { type: 'sellProperty', tile: 31 }).ok).toBe(false);
  });

  it('hands what is left to the creditor and ends a two player game', () => {
    const { game, ids, p } = startedGame(2);
    give(game, ids[1], 31, 3); // $1.4M rent
    give(game, ids[0], 1, 2);
    p(0).cash = 100_000;
    p(0).position = 24;
    queueDice(3, 4);
    game.dispatch(ids[0], { type: 'roll' });
    expect(game.state.phase).toBe('in_debt');
    expect(game.dispatch(ids[0], { type: 'declareBankruptcy' }).ok).toBe(true);
    expect(p(0).bankrupt).toBe(true);
    expect(game.state.holdings[1].owner).toBeNull();
    expect(p(1).cash).toBe(START + 100_000 + 60_000);
    expect(game.state.winnerId).toBe(ids[1]);
    expect(game.state.winReason).toBe('bankruptcy');
  });

  it('keeps going while two players remain', () => {
    const { game, ids, p } = startedGame(3);
    give(game, ids[1], 31, 3);
    p(0).cash = 0;
    p(0).position = 24;
    queueDice(3, 4);
    game.dispatch(ids[0], { type: 'roll' });
    game.dispatch(ids[0], { type: 'declareBankruptcy' });
    expect(game.state.status).toBe('playing');
    expect(game.currentId).toBe(ids[1]);
  });
});

/* ------------------------------------------------------------ the clock */

describe('turn clock', () => {
  const later = () => Date.now() + 10 * 60_000;

  it('rolls for a player who runs out of time', () => {
    const { game, p } = startedGame(2);
    game.tick(later());
    expect(p(0).position).not.toBe(0);
  });

  it('passes on a build that is never answered', () => {
    const { game, ids } = startedGame(2);
    queueDice(1, 3);
    game.dispatch(ids[0], { type: 'roll' });
    game.tick(later());
    expect(game.state.holdings[4].owner).toBeNull();
    expect(game.currentId).toBe(ids[1]);
  });

  it('sells for a debtor who stalls', () => {
    const { game, ids, p } = startedGame(2);
    give(game, ids[1], 4, 2);
    give(game, ids[0], 31, 1);
    p(0).cash = 100_000;
    queueDice(1, 3);
    game.dispatch(ids[0], { type: 'roll' });
    game.tick(later());
    expect(game.state.pendingDebt).toBeNull();
    expect(game.state.holdings[31].owner).toBeNull();
    expect(p(0).bankrupt).toBe(false);
  });
});

/* ------------------------------------------------------------------ bots */

/** Every player a bot; the first is made host so the game can start. */
function botTable(count: number, settings?: Partial<GameSettings>) {
  const game = Game.create('BOTS01', { matchMinutes: 0, ...settings });
  for (let i = 0; i < count; i++) {
    game.addPlayer({ name: `Bot ${i + 1}`, color: COLORS[i], token: TOKENS[i] }, true);
  }
  game.state.hostId = game.state.players[0].id;
  expect(game.start(game.state.hostId).ok).toBe(true);
  return game;
}

/** Let the bots play, asserting every move is legal and the board stays sane. */
function playOut(game: Game, maxSteps = 30_000): number {
  let steps = 0;
  while (game.state.status === 'playing' && steps++ < maxSteps) {
    let acted = false;
    for (const player of game.state.players) {
      if (player.bankrupt) continue;
      const action = botDecision(game.state, player.id);
      if (!action) continue;
      const result = game.dispatch(player.id, action);
      expect(result.error ?? 'ok').toBe('ok');
      acted = true;
      break;
    }
    expect(acted).toBe(true);

    for (const p of game.state.players) {
      expect(p.cash).toBeGreaterThanOrEqual(0);
      expect(p.position).toBeGreaterThanOrEqual(0);
      expect(p.position).toBeLessThan(32);
    }
    for (const index of OWNABLE_INDEXES) {
      const h = game.state.holdings[index];
      expect(h.level).toBeGreaterThanOrEqual(0);
      expect(h.level).toBeLessThanOrEqual(4);
      if (!h.owner) expect(h.level).toBe(0);
      else expect(h.level).toBeGreaterThanOrEqual(1);
    }
  }
  return steps;
}

describe('bots', () => {
  it('rolls on its own turn and stays quiet otherwise', () => {
    const game = botTable(2);
    const [first, second] = game.state.order;
    expect(botDecision(game.state, first)).toEqual({ type: 'roll' });
    expect(botDecision(game.state, second)).toBeNull();
  });

  it('builds as much as it can afford while keeping a reserve', () => {
    const game = botTable(2);
    queueDice(1, 3);
    const id = game.state.order[0];
    game.dispatch(id, { type: 'roll' });
    expect(botDecision(game.state, id)).toEqual({ type: 'build', level: 2 });
    game.state.players.find((p) => p.id === id)!.cash = 200_000;
    expect(botDecision(game.state, id)).toEqual({ type: 'skipBuild' });
  });

  it('only offers options the rules allow', () => {
    const game = botTable(2);
    const id = game.state.order[0];
    expect(buildOptions(game.state, id, 4).map((o) => o.level)).toEqual([1, 2]);
  });

  for (const count of [2, 3, 4]) {
    it(`plays a ${count} bot game through to a winner`, () => {
      resetRandom(0x7e57 + count);
      const game = botTable(count);
      const steps = playOut(game);
      expect(steps).toBeLessThan(30_000);
      expect(game.state.status).toBe('finished');
      expect(game.state.winnerId).toBeTruthy();
      expect(game.state.winReason).toBeTruthy();
      const winner = game.state.players.find((p) => p.id === game.state.winnerId)!;
      expect(winner.bankrupt).toBe(false);
      expect(diceQueue).toHaveLength(0);
    });
  }

  it('wins in every way the rules allow across many seeded games', () => {
    const reasons = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      resetRandom(seed * 7919);
      const game = botTable(2 + (seed % 3));
      playOut(game);
      reasons.add(game.state.winReason ?? 'none');
    }
    expect(reasons.has('none')).toBe(false);
    expect(reasons.size).toBeGreaterThanOrEqual(2);
  });
});

/* -------------------------------------------------------------- recovery */

describe('snapshots', () => {
  it('resumes a mid-game snapshot exactly', () => {
    resetRandom(0x314159);
    const game = botTable(3);
    for (let i = 0; i < 60 && game.state.status === 'playing'; i++) {
      for (const p of game.state.players) {
        const action = botDecision(game.state, p.id);
        if (action) {
          game.dispatch(p.id, action);
          break;
        }
      }
    }
    const clone = new Game(JSON.parse(JSON.stringify(game.state)));
    expect(clone.state.version).toBe(game.state.version);
    expect(clone.currentId).toBe(game.currentId);
    expect(clone.state.holdings).toEqual(game.state.holdings);
  });
});
