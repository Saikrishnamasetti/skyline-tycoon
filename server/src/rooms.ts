import type { Server, Socket } from 'socket.io';
import { Game } from './game/engine';
import { botDecision } from './game/bot';
import { SnapshotStore } from './store';
import { newRoomCode, newToken, sanitizeName } from './util';
import type {
  Ack,
  ClientToServerEvents,
  GameAction,
  GameSettings,
  Identity,
  JoinResult,
  ServerToClientEvents,
} from './shared';

type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

interface Room {
  code: string;
  game: Game;
  /** sessionToken -> playerId */
  sessions: Map<string, string>;
  /** playerId -> socket id (only one live socket per seat) */
  socketByPlayer: Map<string, string>;
  dirty: boolean;
  lastActivity: number;
  /** Bots wait until this time so animations on screen can finish. */
  botReadyAt: number;
}

export interface RoomManagerOptions {
  dataDir: string;
  roomTtlMs: number;
}

const TICK_MS = 250;
const FLUSH_MS = 3000;
const SWEEP_MS = 15000;
const LOBBY_GRACE_MS = 5 * 60 * 1000;
/** Pause before a bot acts, so its moves are readable on screen. */
const BOT_THINK_MS = 1300;

export class RoomManager {
  private rooms = new Map<string, Room>();
  private store: SnapshotStore;
  private socketRoom = new Map<string, string>();
  private socketPlayer = new Map<string, string>();
  private timers: NodeJS.Timeout[] = [];

  constructor(
    private io: Server<ClientToServerEvents, ServerToClientEvents>,
    private options: RoomManagerOptions,
  ) {
    this.store = new SnapshotStore(options.dataDir);
    this.restore();
    this.io.on('connection', (socket) => this.onConnection(socket as GameSocket));
    this.timers.push(setInterval(() => this.tickAll(), TICK_MS));
    this.timers.push(setInterval(() => this.flush(), FLUSH_MS));
    this.timers.push(setInterval(() => this.sweep(), SWEEP_MS));
  }

  stop(): void {
    for (const timer of this.timers) clearInterval(timer);
    this.timers = [];
    this.flush();
  }

  /* --------------------------------------------------------- lifecycle */

  private restore(): void {
    const snapshots = this.store.loadAll(this.options.roomTtlMs);
    for (const snapshot of snapshots) {
      const game = new Game(snapshot.state);
      // No person is connected yet after a restart. Bots live on the server,
      // and the engine never reconnects them, so they stay present.
      for (const player of game.state.players) {
        if (!player.isBot) player.connected = false;
      }
      this.rooms.set(snapshot.state.roomCode, {
        code: snapshot.state.roomCode,
        game,
        sessions: new Map(Object.entries(snapshot.sessions ?? {})),
        socketByPlayer: new Map(),
        dirty: false,
        lastActivity: Date.now(),
        botReadyAt: 0,
      });
    }
    if (snapshots.length > 0) {
      console.log(`[rooms] recovered ${snapshots.length} in-progress room(s)`);
    }
  }

  /** Writes dirty rooms now. Public so the in-browser build can save on unload. */
  flush(): void {
    for (const room of this.rooms.values()) {
      if (!room.dirty) continue;
      room.dirty = false;
      if (room.game.state.status === 'playing') {
        this.store.save({
          state: room.game.state,
          sessions: Object.fromEntries(room.sessions),
          savedAt: Date.now(),
        });
      } else {
        this.store.remove(room.code);
      }
    }
  }

  private sweep(): void {
    const now = Date.now();
    for (const [code, room] of this.rooms) {
      // Bots never leave, so only people keep a room alive.
      const anyoneHere = room.game.state.players.some((p) => p.connected && !p.isBot);
      if (anyoneHere) {
        room.lastActivity = now;
        continue;
      }
      const idleFor = now - room.lastActivity;
      const grace =
        room.game.state.status === 'lobby' ? LOBBY_GRACE_MS : this.options.roomTtlMs;
      if (idleFor > grace) {
        this.rooms.delete(code);
        this.store.remove(code);
        console.log(`[rooms] ${code} closed after being abandoned`);
      }
    }
  }

  private tickAll(): void {
    const now = Date.now();
    for (const room of this.rooms.values()) {
      if (room.game.state.status !== 'playing') continue;
      let changed = false;
      // One expiry may cascade (auto-roll then auto-end-turn), so drain them.
      for (let i = 0; i < 4; i++) {
        if (!room.game.tick(now)) break;
        changed = true;
      }
      if (changed) this.broadcast(room);
      this.runBots(room, now);
    }
  }

  /** At most one bot move per room per tick, spaced by BOT_THINK_MS. */
  private runBots(room: Room, now: number): void {
    if (room.game.state.status !== 'playing' || now < room.botReadyAt) return;
    for (const player of room.game.state.players) {
      if (!player.isBot || player.bankrupt) continue;
      const action = botDecision(room.game.state, player.id);
      if (!action) continue;
      const result = room.game.dispatch(player.id, action);
      if (!result.ok) console.warn(`[bots] ${player.name} tried ${action.type}: ${result.error}`);
      this.broadcast(room);
      return;
    }
  }

  /* -------------------------------------------------------- broadcasting */

  private broadcast(room: Room): void {
    room.dirty = true;
    room.lastActivity = Date.now();
    room.botReadyAt = Date.now() + BOT_THINK_MS;
    const events = room.game.drainEvents();
    // Events first: the client turns move events into walks before the new
    // positions arrive, so pieces travel instead of snapping into place.
    if (events.length > 0) this.io.to(room.code).emit('events', events);
    this.io.to(room.code).emit('state', room.game.state);
  }

  stats(): { rooms: number; players: number } {
    let players = 0;
    for (const room of this.rooms.values()) players += room.game.state.players.length;
    return { rooms: this.rooms.size, players };
  }

  roomSummary(code: string): { exists: boolean; status?: string; players?: number; max?: number } {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return { exists: false };
    return {
      exists: true,
      status: room.game.state.status,
      players: room.game.state.players.length,
      max: room.game.state.settings.maxPlayers,
    };
  }

  /* ------------------------------------------------------------ sockets */

  private onConnection(socket: GameSocket): void {
    socket.on('room:create', (payload, ack) => {
      const identity = this.cleanIdentity(payload?.identity);
      const code = this.uniqueCode();
      const game = Game.create(code, payload?.settings as Partial<GameSettings>);
      const room: Room = {
        code,
        game,
        sessions: new Map(),
        socketByPlayer: new Map(),
        dirty: true,
        lastActivity: Date.now(),
        botReadyAt: 0,
      };
      this.rooms.set(code, room);
      const result = this.seat(socket, room, identity);
      if (!result.ok) {
        this.rooms.delete(code);
        respond(ack, result);
        return;
      }
      console.log(`[rooms] ${code} created`);
      respond(ack, result);
      this.broadcast(room);
    });

    socket.on('room:join', (payload, ack) => {
      const code = String(payload?.code ?? '').trim().toUpperCase();
      const room = this.rooms.get(code);
      if (!room) return respond(ack, { ok: false, error: 'No room with that code' });
      if (room.game.state.status !== 'lobby') {
        return respond(ack, { ok: false, error: 'That game is already under way' });
      }
      if (room.game.isFull) return respond(ack, { ok: false, error: 'That room is full' });
      const result = this.seat(socket, room, this.cleanIdentity(payload?.identity));
      respond(ack, result);
      if (result.ok) this.broadcast(room);
    });

    socket.on('room:rejoin', (payload, ack) => {
      const code = String(payload?.code ?? '').trim().toUpperCase();
      const token = String(payload?.sessionToken ?? '');
      const room = this.rooms.get(code);
      if (!room) return respond(ack, { ok: false, error: 'That room has closed' });
      const playerId = room.sessions.get(token);
      const player = playerId
        ? room.game.state.players.find((p) => p.id === playerId)
        : undefined;
      if (!playerId || !player) {
        return respond(ack, { ok: false, error: 'That seat is no longer reserved' });
      }
      // Drop any stale socket still holding this seat so we never duplicate.
      const previous = room.socketByPlayer.get(playerId);
      if (previous && previous !== socket.id) {
        const old = this.io.sockets.sockets.get(previous);
        if (old) {
          old.emit('kicked', { reason: 'You rejoined this room from another tab.' });
          this.detach(old as GameSocket, { silent: true });
          old.leave(room.code);
        }
      }
      this.attach(socket, room, playerId);
      room.game.setConnected(playerId, true);
      respond(ack, {
        ok: true,
        data: {
          roomCode: room.code,
          playerId,
          sessionToken: token,
          state: room.game.state,
        },
      });
      this.broadcast(room);
    });

    socket.on('room:leave', (ack) => {
      const room = this.roomOf(socket);
      const playerId = this.socketPlayer.get(socket.id);
      if (!room || !playerId) return respond(ack, { ok: false, error: 'You are not in a room' });
      if (room.game.state.status === 'lobby') {
        room.game.removePlayer(playerId);
        for (const [token, id] of room.sessions) {
          if (id === playerId) room.sessions.delete(token);
        }
      } else {
        room.game.setConnected(playerId, false);
      }
      this.detach(socket);
      socket.leave(room.code);
      respond(ack, { ok: true });
      this.broadcast(room);
      if (room.game.state.players.length === 0) {
        this.rooms.delete(room.code);
        this.store.remove(room.code);
      }
    });

    socket.on('room:ready', (payload, ack) => {
      this.withSeat(socket, ack, (room, playerId) =>
        room.game.setReady(playerId, !!payload?.ready),
      );
    });

    socket.on('room:identity', (payload, ack) => {
      this.withSeat(socket, ack, (room, playerId) =>
        room.game.setIdentity(playerId, this.cleanIdentityPatch(payload)),
      );
    });

    socket.on('room:settings', (payload, ack) => {
      this.withSeat(socket, ack, (room, playerId) =>
        room.game.updateSettings(playerId, (payload ?? {}) as Partial<GameSettings>),
      );
    });

    socket.on('room:addBot', (ack) => {
      this.withSeat(socket, ack, (room, playerId) => room.game.addBot(playerId));
    });

    socket.on('room:removeBot', (payload, ack) => {
      this.withSeat(socket, ack, (room, playerId) =>
        room.game.removeBot(playerId, String(payload?.playerId ?? '')),
      );
    });

    socket.on('room:start', (ack) => {
      this.withSeat(socket, ack, (room, playerId) => room.game.start(playerId));
    });

    socket.on('room:rematch', (ack) => {
      this.withSeat(socket, ack, (room, playerId) => room.game.rematch(playerId));
    });

    socket.on('game:action', (action, ack) => {
      this.withSeat(socket, ack, (room, playerId) =>
        room.game.dispatch(playerId, action as GameAction),
      );
    });

    socket.on('disconnect', () => {
      const room = this.roomOf(socket);
      const playerId = this.socketPlayer.get(socket.id);
      this.detach(socket);
      if (!room || !playerId) return;
      // Only clear the seat if this socket still owned it.
      if (!room.socketByPlayer.has(playerId)) {
        room.game.setConnected(playerId, false);
        if (room.game.state.status === 'lobby' && room.game.state.players.length > 1) {
          // Keep the lobby tidy: an empty seat should not block the start.
        }
        this.broadcast(room);
      }
    });
  }

  /* ------------------------------------------------------------ helpers */

  private uniqueCode(): string {
    let code = newRoomCode();
    let guard = 0;
    while (this.rooms.has(code) && guard++ < 50) code = newRoomCode();
    return code;
  }

  private cleanIdentity(raw: unknown): Identity {
    const input = (raw ?? {}) as Partial<Identity>;
    return {
      name: sanitizeName(input.name),
      color: input.color ?? 'cobalt',
      token: input.token ?? 'tower',
    };
  }

  private cleanIdentityPatch(raw: unknown): Partial<Identity> {
    const input = (raw ?? {}) as Partial<Identity>;
    const patch: Partial<Identity> = {};
    if (typeof input.name === 'string') patch.name = sanitizeName(input.name);
    if (input.color) patch.color = input.color;
    if (input.token) patch.token = input.token;
    return patch;
  }

  private seat(socket: GameSocket, room: Room, identity: Identity): Ack<JoinResult> {
    const added = room.game.addPlayer(identity);
    if (!added.ok || !added.playerId) {
      return { ok: false, error: added.error ?? 'Could not join' };
    }
    const token = newToken();
    room.sessions.set(token, added.playerId);
    this.attach(socket, room, added.playerId);
    return {
      ok: true,
      data: {
        roomCode: room.code,
        playerId: added.playerId,
        sessionToken: token,
        state: room.game.state,
      },
    };
  }

  private attach(socket: GameSocket, room: Room, playerId: string): void {
    socket.join(room.code);
    this.socketRoom.set(socket.id, room.code);
    this.socketPlayer.set(socket.id, playerId);
    room.socketByPlayer.set(playerId, socket.id);
    room.lastActivity = Date.now();
  }

  private detach(socket: GameSocket, opts: { silent?: boolean } = {}): void {
    const code = this.socketRoom.get(socket.id);
    const playerId = this.socketPlayer.get(socket.id);
    this.socketRoom.delete(socket.id);
    this.socketPlayer.delete(socket.id);
    if (!code || !playerId) return;
    const room = this.rooms.get(code);
    if (!room) return;
    if (room.socketByPlayer.get(playerId) === socket.id) {
      room.socketByPlayer.delete(playerId);
    }
    if (!opts.silent) room.lastActivity = Date.now();
  }

  private roomOf(socket: GameSocket): Room | undefined {
    const code = this.socketRoom.get(socket.id);
    return code ? this.rooms.get(code) : undefined;
  }

  /**
   * Resolves the caller's seat, runs the handler and broadcasts only when the
   * engine actually changed something.
   */
  private withSeat(
    socket: GameSocket,
    ack: ((res: Ack) => void) | undefined,
    handler: (room: Room, playerId: string) => Ack,
  ): void {
    const room = this.roomOf(socket);
    const playerId = this.socketPlayer.get(socket.id);
    if (!room || !playerId) {
      respond(ack, { ok: false, error: 'You are not seated in a room' });
      return;
    }
    const before = room.game.state.version;
    let result: Ack;
    try {
      result = handler(room, playerId);
    } catch (err) {
      console.error('[rooms] action failed:', err);
      result = { ok: false, error: 'The server could not complete that action' };
    }
    respond(ack, result);
    if (room.game.state.version !== before) this.broadcast(room);
  }
}

function respond<T>(ack: ((res: Ack<T>) => void) | undefined, res: Ack<T>): void {
  if (typeof ack === 'function') ack(res);
}
