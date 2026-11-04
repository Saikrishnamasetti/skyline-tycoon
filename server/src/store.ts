import fs from 'fs';
import path from 'path';
import type { GameState } from './shared';

/**
 * Crash-recovery snapshots. Rooms live in memory for speed; each change marks
 * the room dirty and a background flush writes one JSON file per room. On
 * boot every snapshot is read back so an in-progress game survives a restart
 * or a deploy.
 */

export interface Snapshot {
  state: GameState;
  /** sessionToken -> playerId, so refreshed browsers reclaim their seat. */
  sessions: Record<string, string>;
  savedAt: number;
}

export class SnapshotStore {
  constructor(private dir: string) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (err) {
      console.warn('[store] could not create data dir:', (err as Error).message);
    }
  }

  private fileFor(code: string): string {
    return path.join(this.dir, `room-${code}.json`);
  }

  save(snapshot: Snapshot): void {
    const file = this.fileFor(snapshot.state.roomCode);
    const tmp = `${file}.tmp`;
    try {
      fs.writeFileSync(tmp, JSON.stringify(snapshot), 'utf8');
      fs.renameSync(tmp, file);
    } catch (err) {
      console.warn('[store] save failed:', (err as Error).message);
    }
  }

  remove(code: string): void {
    try {
      fs.rmSync(this.fileFor(code), { force: true });
    } catch {
      /* the snapshot is best effort */
    }
  }

  loadAll(maxAgeMs: number): Snapshot[] {
    let names: string[] = [];
    try {
      names = fs.readdirSync(this.dir);
    } catch {
      return [];
    }
    const out: Snapshot[] = [];
    for (const name of names) {
      if (!name.startsWith('room-') || !name.endsWith('.json')) continue;
      const full = path.join(this.dir, name);
      try {
        const snapshot = JSON.parse(fs.readFileSync(full, 'utf8')) as Snapshot;
        const fresh = Date.now() - (snapshot.savedAt ?? 0) < maxAgeMs;
        const worthKeeping = snapshot.state?.status === 'playing';
        if (fresh && worthKeeping && snapshot.state.roomCode) {
          out.push(snapshot);
        } else {
          fs.rmSync(full, { force: true });
        }
      } catch {
        fs.rmSync(full, { force: true });
      }
    }
    return out;
  }
}
