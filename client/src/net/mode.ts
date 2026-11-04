import { useSyncExternalStore } from 'react';

/**
 * Which game servers this build can talk to.
 *
 * - The Node server serves its own client: online only, same origin.
 * - The static build (VITE_LOCAL_MODE=true, e.g. GitHub Pages) bundles the
 *   game server into the page for solo games against bots, and also plays
 *   online when VITE_SERVER_URL points at a hosted Node server.
 */
export const SOLO_AVAILABLE: boolean = import.meta.env.VITE_LOCAL_MODE === 'true';

const serverUrl = (import.meta.env.VITE_SERVER_URL as string | undefined)?.trim();

export const ONLINE_AVAILABLE: boolean = !SOLO_AVAILABLE || !!serverUrl;

/** online: rooms on the Node server. solo: the in-page server, you and bots. */
export type NetMode = 'online' | 'solo';

let current: NetMode = ONLINE_AVAILABLE ? 'online' : 'solo';
const listeners = new Set<() => void>();

export function getNetMode(): NetMode {
  return current;
}

/** Points the UI at a game server. Ignored when this build does not have it. */
export function setNetMode(next: NetMode): void {
  const available = next === 'solo' ? SOLO_AVAILABLE : ONLINE_AVAILABLE;
  if (!available || next === current) return;
  current = next;
  for (const fn of listeners) fn();
}

export function subscribeNetMode(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useNetMode(): NetMode {
  return useSyncExternalStore(subscribeNetMode, getNetMode);
}
