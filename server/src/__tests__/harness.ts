import type { AddressInfo } from 'net';
import { io as ioClient } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { buildApp } from '../app';
import type {
  Ack,
  GameAction,
  GameSettings,
  GameState,
  Identity,
  JoinResult,
} from '../shared';

/**
 * Spins up the real HTTP + Socket.IO server and drives it with real socket
 * clients, which is the only way to prove the acceptance criteria: separate
 * browser sessions seeing one synchronised game.
 */

export interface TestServer {
  url: string;
  close: () => Promise<void>;
}

export async function startTestServer(dataDir: string): Promise<TestServer> {
  const built = buildApp({
    clientOrigin: '*',
    dataDir,
    roomTtlMs: 60_000,
    serveClient: false,
  });
  await new Promise<void>((resolve) => built.server.listen(0, '127.0.0.1', () => resolve()));
  const address = built.server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: built.close,
  };
}

export class TestClient {
  socket: Socket;
  state: GameState | null = null;
  playerId: string | null = null;
  sessionToken: string | null = null;
  roomCode: string | null = null;
  stateCount = 0;

  private constructor(socket: Socket) {
    this.socket = socket;
    socket.on('state', (state: GameState) => {
      this.state = state;
      this.stateCount++;
    });
  }

  static async connect(url: string): Promise<TestClient> {
    const socket = ioClient(url, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('connect timed out')), 5000);
      socket.on('connect', () => {
        clearTimeout(timer);
        resolve();
      });
      socket.on('connect_error', (err: Error) => {
        clearTimeout(timer);
        reject(err);
      });
    });
    return new TestClient(socket);
  }

  private emit<T>(event: string, payload?: unknown): Promise<Ack<T>> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve({ ok: false, error: 'ack timed out' }), 5000);
      const ack = (res: Ack<T>) => {
        clearTimeout(timer);
        resolve(res ?? { ok: false, error: 'empty ack' });
      };
      if (payload === undefined) this.socket.emit(event, ack);
      else this.socket.emit(event, payload, ack);
    });
  }

  private remember(res: Ack<JoinResult>): void {
    if (!res.ok || !res.data) return;
    this.playerId = res.data.playerId;
    this.sessionToken = res.data.sessionToken;
    this.roomCode = res.data.roomCode;
    this.state = res.data.state;
  }

  async createRoom(identity: Identity, settings?: Partial<GameSettings>) {
    const res = await this.emit<JoinResult>('room:create', { identity, settings });
    this.remember(res);
    return res;
  }

  async joinRoom(code: string, identity: Identity) {
    const res = await this.emit<JoinResult>('room:join', { code, identity });
    this.remember(res);
    return res;
  }

  async rejoin(code: string, token: string) {
    const res = await this.emit<JoinResult>('room:rejoin', { code, sessionToken: token });
    this.remember(res);
    return res;
  }

  ready(value = true) {
    return this.emit('room:ready', { ready: value });
  }
  start() {
    return this.emit('room:start');
  }
  leave() {
    return this.emit('room:leave');
  }
  settings(patch: Partial<GameSettings>) {
    return this.emit('room:settings', patch);
  }
  addBot() {
    return this.emit('room:addBot');
  }
  act(action: GameAction) {
    return this.emit('game:action', action);
  }

  get me() {
    return this.state?.players.find((p) => p.id === this.playerId) ?? null;
  }

  disconnect(): void {
    this.socket.disconnect();
  }

  /** Resolves once this client has received a state newer than `version`. */
  waitForVersionAbove(version: number, timeoutMs = 8000): Promise<number> {
    if (this.state && this.state.version > version) {
      return Promise.resolve(this.state.version);
    }
    return this.waitForState((s) => s.version > version, timeoutMs, `version > ${version}`);
  }

  /** Resolves once this client has caught up to at least `version`. */
  waitForVersionAtLeast(version: number, timeoutMs = 8000): Promise<number> {
    if (this.state && this.state.version >= version) {
      return Promise.resolve(this.state.version);
    }
    return this.waitForState((s) => s.version >= version, timeoutMs, `version >= ${version}`);
  }

  private waitForState(
    predicate: (state: GameState) => boolean,
    timeoutMs: number,
    label: string,
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      const onState = (state: GameState) => {
        if (!predicate(state)) return;
        clearTimeout(timer);
        this.socket.off('state', onState);
        resolve(state.version);
      };
      const timer = setTimeout(() => {
        this.socket.off('state', onState);
        reject(new Error(`Timed out waiting for ${label}`));
      }, timeoutMs);
      this.socket.on('state', onState);
    });
  }
}

export function waitFor(
  predicate: () => boolean,
  timeoutMs = 4000,
  label = 'condition',
): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const check = () => {
      if (predicate()) return resolve();
      if (Date.now() - started > timeoutMs) return reject(new Error(`Timed out waiting for ${label}`));
      setTimeout(check, 15);
    };
    check();
  });
}

export const identity = (name: string): Identity => ({
  name,
  color: 'cobalt',
  token: 'tower',
});
