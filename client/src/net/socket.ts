import { io, Socket } from 'socket.io-client';
import type {
  Ack,
  ClientToServerEvents,
  GameAction,
  GameSettings,
  Identity,
  JoinResult,
  ServerToClientEvents,
} from '@shared';

import { getNetMode, type NetMode } from './mode';
import { connectLocal, localRoomSummary } from './local/localServer';

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SERVER_URL: string =
  (import.meta.env.VITE_SERVER_URL as string | undefined)?.trim() ||
  (typeof window !== 'undefined' ? window.location.origin : '');

const sockets: Partial<Record<NetMode, GameSocket>> = {};

/** The socket for the current mode (see net/mode), created on first use. */
export function getSocket(): GameSocket {
  const mode = getNetMode();
  let socket = sockets[mode];
  if (!socket) {
    socket =
      mode === 'solo'
        ? // The game server runs in this page (see local/localServer).
          (connectLocal() as unknown as GameSocket)
        : io(SERVER_URL, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 600,
            reconnectionDelayMax: 4000,
            reconnectionAttempts: Infinity,
            timeout: 12000,
          });
    sockets[mode] = socket;
  }
  return socket;
}

/** Promise wrapper so components can await a server acknowledgement. */
function request<T>(event: keyof ClientToServerEvents, ...args: unknown[]): Promise<Ack<T>> {
  return new Promise((resolve) => {
    const active = getSocket();
    let settled = false;
    const done = (res: Ack<T>) => {
      if (settled) return;
      settled = true;
      resolve(res);
    };
    // socket.io queues the message until it connects. A sleeping free host
    // can take most of a minute to start, so wait longer in that case.
    const waking = !active.connected;
    const timer = window.setTimeout(
      () =>
        done({
          ok: false,
          error: waking
            ? 'The game server did not wake up in time. Try again, or play solo.'
            : 'The server did not respond. Check your connection.',
        }),
      waking ? 90000 : 12000,
    );
    const ack = (res: Ack<T>) => {
      window.clearTimeout(timer);
      done(res ?? { ok: false, error: 'Empty response' });
    };
    // socket.io forwards the trailing function as the acknowledgement.
    (active.emit as (ev: string, ...a: unknown[]) => void)(event, ...args, ack);
  });
}

export const api = {
  createRoom: (identity: Identity, settings?: Partial<GameSettings>) =>
    request<JoinResult>('room:create', { identity, settings }),
  joinRoom: (code: string, identity: Identity) =>
    request<JoinResult>('room:join', { code: code.toUpperCase(), identity }),
  rejoinRoom: (code: string, sessionToken: string) =>
    request<JoinResult>('room:rejoin', { code: code.toUpperCase(), sessionToken }),
  leaveRoom: () => request('room:leave'),
  setReady: (ready: boolean) => request('room:ready', { ready }),
  setIdentity: (patch: Partial<Identity>) => request('room:identity', patch),
  setSettings: (patch: Partial<GameSettings>) => request('room:settings', patch),
  addBot: () => request('room:addBot'),
  removeBot: (playerId: string) => request('room:removeBot', { playerId }),
  startGame: () => request('room:start'),
  rematch: () => request('room:rematch'),
  action: (action: GameAction) => request('game:action', action),
};

/** Used by the join screen to distinguish a bad code from a full room. */
export async function peekRoom(code: string): Promise<{
  exists: boolean;
  status?: string;
  players?: number;
  max?: number;
}> {
  if (getNetMode() === 'solo') return localRoomSummary(code.toUpperCase());
  try {
    const base = SERVER_URL || '';
    const res = await fetch(`${base}/api/rooms/${encodeURIComponent(code.toUpperCase())}`);
    if (!res.ok) return { exists: false };
    return (await res.json()) as { exists: boolean };
  } catch {
    return { exists: false };
  }
}

/* ----------------------------------------------------- seat persistence */

interface StoredSeat {
  playerId: string;
  sessionToken: string;
}

// Solo and online rooms come from different servers, so keep their seats apart.
const seatKey = (code: string) =>
  `skyline.${getNetMode() === 'solo' ? 'solo.' : ''}seat.${code.toUpperCase()}`;

export function rememberSeat(code: string, seat: StoredSeat): void {
  try {
    localStorage.setItem(seatKey(code), JSON.stringify(seat));
  } catch {
    /* private mode: reconnection simply will not be available */
  }
}

export function recallSeat(code: string): StoredSeat | null {
  try {
    const raw = localStorage.getItem(seatKey(code));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSeat;
    return parsed?.sessionToken ? parsed : null;
  } catch {
    return null;
  }
}

export function forgetSeat(code: string): void {
  try {
    localStorage.removeItem(seatKey(code));
  } catch {
    /* ignore */
  }
}

const PROFILE_KEY = 'skyline.profile';

export function loadProfile(): Identity {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Identity>;
      return {
        name: parsed.name ?? '',
        color: parsed.color ?? 'cobalt',
        token: parsed.token ?? 'tower',
      };
    }
  } catch {
    /* ignore */
  }
  return { name: '', color: 'cobalt', token: 'tower' };
}

export function saveProfile(identity: Identity): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(identity));
  } catch {
    /* ignore */
  }
}
