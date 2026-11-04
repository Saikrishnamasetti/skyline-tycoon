// Imported first: this installs the seeded dice so a full game over sockets
// always plays out the same way and the suite can never be flaky.
import { resetRandom } from './helpers';

import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { OWNABLE_INDEXES } from '../shared';
import type { GameState } from '../shared';
import { decideMove } from '../game/bot';
import { TestClient, identity, startTestServer, waitFor } from './harness';
import type { TestServer } from './harness';

let server: TestServer;
let dataDir: string;
const openClients: TestClient[] = [];

beforeAll(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skyline-test-'));
  server = await startTestServer(dataDir);
});

afterAll(async () => {
  for (const client of openClients) client.disconnect();
  await server.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

async function connect(name: string): Promise<TestClient> {
  const client = await TestClient.connect(server.url);
  openClients.push(client);
  return client;
}

/** Seats `count` players in one room and starts the game. */
async function seatRoom(count: number, settings?: Record<string, unknown>) {
  const host = await connect('host');
  const created = await host.createRoom(identity('Host'), settings as never);
  expect(created.ok).toBe(true);
  const code = created.data!.roomCode;

  const guests: TestClient[] = [];
  for (let i = 1; i < count; i++) {
    const guest = await connect(`guest${i}`);
    const joined = await guest.joinRoom(code, identity(`Guest${i}`));
    expect(joined.ok).toBe(true);
    guests.push(guest);
  }
  for (const guest of guests) expect((await guest.ready(true)).ok).toBe(true);
  await waitFor(
    () => host.state?.players.filter((p) => p.ready || p.id === host.state?.hostId).length === count,
    4000,
    'everyone ready',
  );
  expect((await host.start()).ok).toBe(true);
  await waitFor(() => host.state?.status === 'playing', 4000, 'game start');

  const all = [host, ...guests];
  return { host, guests, all, code };
}

/** All clients must agree on the parts of the state that matter. */
function fingerprint(state: GameState): string {
  return JSON.stringify({
    version: state.version,
    phase: state.phase,
    currentIndex: state.currentIndex,
    cash: state.players.map((p) => [p.id, p.cash, p.position, p.bankrupt]),
    owners: OWNABLE_INDEXES.map((i) => [i, state.holdings[i].owner, state.holdings[i].level]),
    championship: state.championship,
  });
}

async function expectSynced(clients: TestClient[]): Promise<void> {
  const top = Math.max(...clients.map((c) => c.state?.version ?? -1));
  await waitFor(
    () => clients.every((c) => (c.state?.version ?? -1) === top),
    4000,
    'clients to converge',
  );
  const prints = clients.map((c) => fingerprint(c.state!));
  for (const print of prints) expect(print).toBe(prints[0]);
}

describe('rooms over real sockets', () => {
  it('creates a room with a six character code and seats the host', async () => {
    const host = await connect('solo');
    const res = await host.createRoom(identity('Solo'));
    expect(res.ok).toBe(true);
    expect(res.data!.roomCode).toMatch(/^[A-Z0-9]{6}$/);
    expect(res.data!.sessionToken.length).toBeGreaterThan(10);
    expect(res.data!.state.players).toHaveLength(1);
    expect(res.data!.state.hostId).toBe(res.data!.playerId);
  });

  it('rejects an unknown room code', async () => {
    const client = await connect('lost');
    const res = await client.joinRoom('ZZZZZZ', identity('Lost'));
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/no room/i);
  });

  it('refuses a fifth player and refuses joining a running game', async () => {
    const { code } = await seatRoom(4);
    const fifth = await connect('fifth');
    const res = await fifth.joinRoom(code, identity('Fifth'));
    expect(res.ok).toBe(false);
  });

  it('pushes every lobby change to all connected clients', async () => {
    const host = await connect('h2');
    const created = await host.createRoom(identity('Host'));
    const code = created.data!.roomCode;
    const guest = await connect('g2');
    await guest.joinRoom(code, identity('Guest'));

    await waitFor(() => host.state?.players.length === 2, 3000, 'host sees the guest');
    await guest.ready(true);
    await waitFor(
      () => host.state?.players.some((p) => p.id === guest.playerId && p.ready) === true,
      3000,
      'host sees ready',
    );
    expect(guest.state?.players).toHaveLength(2);
  });

  it('gives each seat a distinct colour and piece', async () => {
    const { host } = await seatRoom(4);
    const colors = new Set(host.state!.players.map((p) => p.color));
    const tokens = new Set(host.state!.players.map((p) => p.token));
    expect(colors.size).toBe(4);
    expect(tokens.size).toBe(4);
  });
});

describe('turn safety over real sockets', () => {
  it('rejects a roll from a player whose turn it is not', async () => {
    const { host, all } = await seatRoom(3);
    const currentId = host.state!.order[host.state!.currentIndex];
    const impostor = all.find((c) => c.playerId !== currentId)!;
    const res = await impostor.act({ type: 'roll' });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/not your turn/i);
  });

  it('rejects building when nothing is on offer', async () => {
    const { all, host } = await seatRoom(2);
    const current = all.find((c) => c.playerId === host.state!.order[host.state!.currentIndex])!;
    const res = await current.act({ type: 'build', level: 3 });
    expect(res.ok).toBe(false);
  });

  it('rejects a buyout, a flight or a sale nobody offered', async () => {
    const { all, host } = await seatRoom(2);
    const current = all.find((c) => c.playerId === host.state!.order[host.state!.currentIndex])!;
    expect((await current.act({ type: 'buyout' })).ok).toBe(false);
    expect((await current.act({ type: 'travel', tile: 31 })).ok).toBe(false);
    expect((await current.act({ type: 'sellProperty', tile: 1 })).ok).toBe(false);
  });

  it('refuses trades unless the table switched them on', async () => {
    const { all, host } = await seatRoom(2);
    const current = all.find((c) => c.playerId === host.state!.order[host.state!.currentIndex])!;
    const other = all.find((c) => c !== current)!;
    const res = await current.act({
      type: 'proposeTrade',
      toId: other.playerId!,
      offerCash: 1000,
      requestCash: 0,
      offerTiles: [],
      requestTiles: [],
    });
    expect(res.error).toMatch(/trading is off/i);
  });

  it('rejects a trade offering more cash than the proposer has', async () => {
    const { all, host } = await seatRoom(2, { tradingEnabled: true });
    const current = all.find((c) => c.playerId === host.state!.order[host.state!.currentIndex])!;
    const other = all.find((c) => c !== current)!;
    const res = await current.act({
      type: 'proposeTrade',
      toId: other.playerId!,
      offerCash: 50_000_000,
      requestCash: 0,
      offerTiles: [],
      requestTiles: [],
    });
    expect(res.error).toMatch(/cash/i);
  });

  it('refuses to start with one player and lets only the host start', async () => {
    const solo = await connect('alone');
    await solo.createRoom(identity('Alone'));
    expect((await solo.start()).error).toMatch(/two tycoons/i);

    const host = await connect('h3');
    const created = await host.createRoom(identity('Host'));
    const guest = await connect('g3');
    await guest.joinRoom(created.data!.roomCode, identity('Guest'));
    await guest.ready(true);
    expect((await guest.start()).error).toMatch(/host/i);
  });
});

describe('bots in a room', () => {
  it('lets the host seat a bot that then plays its own turns', async () => {
    const host = await connect('bot-host');
    await host.createRoom(identity('Host'));
    expect((await host.addBot()).ok).toBe(true);
    await waitFor(() => host.state?.players.length === 2, 3000, 'bot seated');
    const bot = host.state!.players.find((p) => p.isBot)!;
    expect(bot.ready).toBe(true);
    expect((await host.start()).ok).toBe(true);
    await waitFor(() => host.state?.status === 'playing', 3000, 'start');

    // If the person goes first, play their turn so the bot gets its go.
    for (let i = 0; i < 12; i++) {
      const s = host.state!;
      if (s.status !== 'playing' || s.order[s.currentIndex] !== host.playerId) break;
      const move = decideMove(s, host.playerId!);
      if (!move) break;
      await send(host, move);
    }
    await waitFor(
      () => host.state!.log.some((entry) => entry.playerId === bot.id && entry.kind === 'roll'),
      // Bots wait for the dice and the walk to finish on screen first.
      12_000,
      'the bot to roll',
    );
  }, 20_000);
});

describe('reconnection', () => {
  it('reclaims the same seat after a refresh instead of adding a player', async () => {
    const { host, guests, code } = await seatRoom(2);
    const guest = guests[0];
    const originalId = guest.playerId!;
    const token = guest.sessionToken!;

    guest.disconnect();
    await waitFor(
      () => host.state?.players.find((p) => p.id === originalId)?.connected === false,
      5000,
      'host to see the drop',
    );
    expect(host.state!.players).toHaveLength(2);

    // A refreshed browser: brand new socket, same stored session token.
    const refreshed = await connect('refreshed');
    const res = await refreshed.rejoin(code, token);
    expect(res.ok).toBe(true);
    expect(res.data!.playerId).toBe(originalId);
    expect(res.data!.state.players).toHaveLength(2);

    await waitFor(
      () => host.state?.players.find((p) => p.id === originalId)?.connected === true,
      4000,
      'host to see the reconnect',
    );
    expect(host.state!.players).toHaveLength(2);
    expect(new Set(host.state!.players.map((p) => p.id)).size).toBe(2);
  });

  it('refuses a made up session token', async () => {
    const { code } = await seatRoom(2);
    const stranger = await connect('stranger');
    const res = await stranger.rejoin(code, 'not-a-real-token');
    expect(res.ok).toBe(false);
  });

  it('keeps a disconnected player in the game so their assets survive', async () => {
    const { host, guests } = await seatRoom(3);
    const leaver = guests[0];
    const id = leaver.playerId!;
    leaver.disconnect();
    await waitFor(
      () => host.state?.players.find((p) => p.id === id)?.connected === false,
      5000,
      'presence update',
    );
    const player = host.state!.players.find((p) => p.id === id)!;
    expect(player.bankrupt).toBe(false);
    expect(host.state!.order).toContain(id);
  });
});

/** Send an action and, if accepted, wait for the resulting state to arrive. */
async function send(client: TestClient, action: Parameters<TestClient['act']>[0]): Promise<boolean> {
  const before = client.state?.version ?? 0;
  const res = await client.act(action);
  if (res.ok) await client.waitForVersionAbove(before);
  return res.ok;
}

/**
 * Plays a whole game through the socket layer. Each decision is made with
 * the same policy the server bots use, and sent by whichever client owns it,
 * so turn and ownership checks run exactly as they do in a real match.
 */
async function playFullGame(all: TestClient[], maxSteps = 20_000): Promise<void> {
  const byId = new Map(all.map((c) => [c.playerId!, c]));
  let lastVersion = -1;
  let stalled = 0;

  for (let step = 0; step < maxSteps; step++) {
    const state = all[0].state!;
    if (state.status !== 'playing') return;
    if (state.version === lastVersion) {
      if (++stalled > 400) throw new Error(`Game stalled in ${state.phase} at v${state.version}`);
    } else {
      lastVersion = state.version;
      stalled = 0;
    }

    let acted = false;
    for (const player of state.players) {
      if (player.bankrupt) continue;
      const move = decideMove(state, player.id);
      if (!move) continue;
      await send(byId.get(player.id)!, move);
      acted = true;
      break;
    }
    if (!acted) await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

describe('complete games across separate socket sessions', () => {
  for (const playerCount of [2, 3, 4]) {
    it(
      `runs a ${playerCount} player game to a winner with every client in sync`,
      async () => {
        resetRandom(0x5c0000 + playerCount);
        const { all } = await seatRoom(playerCount, { matchMinutes: 0, turnSeconds: 90 });
        await playFullGame(all);

        const state = all[0].state!;
        expect(state.status).toBe('finished');
        expect(state.winnerId).toBeTruthy();
        expect(state.winReason).toBeTruthy();
        await expectSynced(all);
        for (const client of all) {
          expect(client.state!.winnerId).toBe(state.winnerId);
          expect(client.state!.winReason).toBe(state.winReason);
        }
      },
      180_000,
    );
  }

  it('keeps every observer in agreement after each move', async () => {
    resetRandom(0xabc);
    const { all } = await seatRoom(3, { matchMinutes: 0, turnSeconds: 90 });
    const byId = new Map(all.map((c) => [c.playerId!, c]));
    for (let move = 0; move < 40; move++) {
      const state = all[0].state!;
      if (state.status !== 'playing') break;
      const actor = state.players.find((p) => !p.bankrupt && decideMove(state, p.id));
      if (!actor) break;
      await send(byId.get(actor.id)!, decideMove(state, actor.id)!);
      await expectSynced(all);
    }
    expect(all[0].state!.version).toBeGreaterThan(1);
  }, 60_000);
});
