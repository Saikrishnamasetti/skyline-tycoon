/**
 * Browser stand-in for server/src/store.ts, swapped in by the Vite config.
 * Snapshots go to localStorage, so a refresh mid-game resumes the same game.
 */
import type { GameState } from '@shared';

export interface Snapshot {
  state: GameState;
  sessions: Record<string, string>;
  savedAt: number;
}

const PREFIX = 'skyline.local.room.';

export class SnapshotStore {
  // The directory argument only matters on the server.
  constructor(_dir: string) {}

  save(snapshot: Snapshot): void {
    try {
      localStorage.setItem(PREFIX + snapshot.state.roomCode, JSON.stringify(snapshot));
    } catch {
      /* storage full or blocked: the game still runs, it just will not resume */
    }
  }

  remove(code: string): void {
    try {
      localStorage.removeItem(PREFIX + code);
    } catch {
      /* ignore */
    }
  }

  loadAll(maxAgeMs: number): Snapshot[] {
    const out: Snapshot[] = [];
    let keys: string[] = [];
    try {
      keys = Object.keys(localStorage).filter((k) => k.startsWith(PREFIX));
    } catch {
      return out;
    }
    for (const key of keys) {
      try {
        const snapshot = JSON.parse(localStorage.getItem(key) ?? '') as Snapshot;
        const fresh = Date.now() - (snapshot.savedAt ?? 0) < maxAgeMs;
        if (fresh && snapshot.state?.status === 'playing' && snapshot.state.roomCode) {
          out.push(snapshot);
        } else {
          localStorage.removeItem(key);
        }
      } catch {
        try {
          localStorage.removeItem(key);
        } catch {
          /* ignore */
        }
      }
    }
    return out;
  }
}
