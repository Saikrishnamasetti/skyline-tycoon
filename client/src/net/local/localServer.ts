/**
 * The game server, running inside the page.
 *
 * Static hosts such as GitHub Pages cannot run Node, so the static build
 * bundles the real server modules (RoomManager, the rules engine and the bot
 * policy) and connects them to the UI through an in-memory stand-in for
 * Socket.IO. The UI code is unchanged: it still sends intents and receives
 * state and events. Everything crossing the boundary is cloned, exactly as if
 * it had gone over the wire, so the UI never holds the engine's live objects.
 */
import { RoomManager } from '../../../../server/src/rooms';

type Handler = (...args: any[]) => void;

/** Server messages arrive on a later task, like real network traffic. */
const defer = (fn: () => void) => window.setTimeout(fn, 0);
const wire = <T>(value: T): T => (value === undefined ? value : structuredClone(value));

class Emitter {
  private handlers = new Map<string, Set<Handler>>();

  on(event: string, fn: Handler): this {
    let set = this.handlers.get(event);
    if (!set) this.handlers.set(event, (set = new Set()));
    set.add(fn);
    return this;
  }

  off(event: string, fn?: Handler): this {
    if (fn) this.handlers.get(event)?.delete(fn);
    else this.handlers.delete(event);
    return this;
  }

  protected fire(event: string, args: unknown[]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const fn of [...set]) fn(...args);
  }
}

/** What RoomManager sees: the server half of one connection. */
class ServerSideSocket extends Emitter {
  readonly rooms = new Set<string>();

  constructor(
    readonly id: string,
    private peer: LocalClientSocket,
  ) {
    super();
  }

  join(room: string): void {
    this.rooms.add(room);
  }

  leave(room: string): void {
    this.rooms.delete(room);
  }

  emit(event: string, ...args: unknown[]): boolean {
    this.peer.deliver(event, args);
    return true;
  }

  receive(event: string, args: unknown[]): void {
    this.fire(event, args);
  }
}

/** What the UI sees: the subset of a socket.io-client Socket it uses. */
export class LocalClientSocket extends Emitter {
  connected = false;
  server!: ServerSideSocket;

  constructor(readonly id: string) {
    super();
  }

  emit(event: string, ...args: unknown[]): this {
    const ack = typeof args[args.length - 1] === 'function' ? (args.pop() as Handler) : undefined;
    const payload = args.map(wire);
    if (ack) {
      payload.push((res: unknown) => {
        const copy = wire(res);
        defer(() => ack(copy));
      });
    }
    defer(() => this.server.receive(event, payload));
    return this;
  }

  deliver(event: string, args: unknown[]): void {
    const copy = args.map(wire);
    defer(() => this.fire(event, copy));
  }

  open(): void {
    this.connected = true;
    defer(() => this.fire('connect', []));
  }
}

/** What RoomManager sees as the Socket.IO server. */
class LocalIO {
  readonly sockets = { sockets: new Map<string, ServerSideSocket>() };
  private onConnection: Handler[] = [];
  private seq = 0;

  on(event: string, fn: Handler): this {
    if (event === 'connection') this.onConnection.push(fn);
    return this;
  }

  to(room: string) {
    return {
      emit: (event: string, ...args: unknown[]) => {
        for (const socket of this.sockets.sockets.values()) {
          if (socket.rooms.has(room)) socket.emit(event, ...args);
        }
      },
    };
  }

  connect(): LocalClientSocket {
    const id = `local-${++this.seq}`;
    const client = new LocalClientSocket(id);
    const server = new ServerSideSocket(id, client);
    client.server = server;
    this.sockets.sockets.set(id, server);
    for (const fn of this.onConnection) fn(server);
    client.open();
    return client;
  }
}

let io: LocalIO | null = null;
let rooms: RoomManager | null = null;

function boot(): LocalIO {
  if (io) return io;
  io = new LocalIO();
  rooms = new RoomManager(io as unknown as ConstructorParameters<typeof RoomManager>[0], {
    dataDir: '',
    roomTtlMs: 45 * 60 * 1000,
  });
  // Save the game when the tab is hidden or closed, so a refresh resumes it.
  const save = () => rooms?.flush();
  window.addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') save();
  });
  return io;
}

export function connectLocal(): LocalClientSocket {
  return boot().connect();
}

export function localRoomSummary(code: string): ReturnType<RoomManager['roomSummary']> {
  boot();
  return rooms ? rooms.roomSummary(code) : { exists: false };
}
