import { create } from 'zustand';
import { BOARD, HOTEL_LEVEL, formatCompact } from '@shared';
import type { GameEvent, GameState, Identity } from '@shared';
import { sfx } from '../lib/audio';

export type ConnectionStatus = 'idle' | 'connecting' | 'online' | 'offline';

export interface Toast {
  id: number;
  title: string;
  detail?: string;
  tone: 'good' | 'bad' | 'info' | 'gold';
  playerId?: string;
}

/** Where a token should be, and whether it walks or teleports there. */
export interface TokenTarget {
  index: number;
  walk: boolean;
  /** Negative when a card sends the player backwards. */
  steps: number;
  seq: number;
}

export interface DiceAnim {
  rollId: number;
  values: [number, number];
  startedAt: number;
}

export interface CardOverlay {
  text: string;
  deck: string;
  playerId: string;
  at: number;
}

interface GameStore {
  status: ConnectionStatus;
  state: GameState | null;
  playerId: string | null;
  roomCode: string | null;
  error: string | null;
  toasts: Toast[];
  tokens: Record<string, TokenTarget>;
  dice: DiceAnim | null;
  cardOverlay: CardOverlay | null;
  selectedTile: number | null;
  sound: boolean;
  profile: Identity;

  setStatus: (status: ConnectionStatus) => void;
  setError: (error: string | null) => void;
  applyState: (state: GameState) => void;
  applyEvents: (events: GameEvent[]) => void;
  setSeat: (roomCode: string, playerId: string) => void;
  clearRoom: () => void;
  pushToast: (toast: Omit<Toast, 'id'>) => void;
  dismissToast: (id: number) => void;
  selectTile: (index: number | null) => void;
  setSound: (value: boolean) => void;
  setProfile: (identity: Identity) => void;
  dismissCard: () => void;
}

let toastSeq = 0;
let tokenSeq = 0;

export const useGame = create<GameStore>((set, get) => ({
  status: 'idle',
  state: null,
  playerId: null,
  roomCode: null,
  error: null,
  toasts: [],
  tokens: {},
  dice: null,
  cardOverlay: null,
  selectedTile: null,
  sound: true,
  profile: { name: '', color: 'cobalt', token: 'tower' },

  setStatus: (status) => set({ status }),
  setError: (error) => set({ error }),

  applyState: (state) => {
    const tokens = { ...get().tokens };
    // Move events arrive before the state that follows them, so a piece is
    // normally already heading for its new tile. Anything still out of place
    // (first load, a reconnect, a missed event) is placed directly.
    for (const player of state.players) {
      const target = tokens[player.id];
      if (!target || target.index !== player.position) {
        tokens[player.id] = { index: player.position, walk: false, steps: 0, seq: ++tokenSeq };
      }
    }
    set({ state, tokens, roomCode: state.roomCode });
  },

  setSeat: (roomCode, playerId) => set({ roomCode, playerId }),
  clearRoom: () =>
    set({
      state: null,
      playerId: null,
      roomCode: null,
      tokens: {},
      dice: null,
      toasts: [],
      cardOverlay: null,
      selectedTile: null,
    }),

  pushToast: (toast) =>
    set((current) => ({ toasts: [...current.toasts, { ...toast, id: ++toastSeq }].slice(-5) })),
  dismissToast: (id) => set((current) => ({ toasts: current.toasts.filter((t) => t.id !== id) })),
  selectTile: (index) => set({ selectedTile: index }),
  setSound: (value) => set({ sound: value }),
  setProfile: (profile) => set({ profile }),
  dismissCard: () => set({ cardOverlay: null }),

  applyEvents: (events) => applyEventsImpl(set, get, events),
}));

type SetFn = (partial: Partial<GameStore> | ((s: GameStore) => Partial<GameStore>)) => void;
type GetFn = () => GameStore;

/**
 * Turns the server event stream into animation targets, sound cues and
 * toasts. The authoritative numbers always come from `state`; these events
 * only drive presentation.
 */
function applyEventsImpl(set: SetFn, get: GetFn, events: GameEvent[]): void {
  const store = get();
  const me = store.playerId;
  const state = store.state;
  const tokens = { ...store.tokens };
  const queued: Omit<Toast, 'id'>[] = [];
  let dice = store.dice;
  let cardOverlay = store.cardOverlay;
  const nameOf = (id: string | null | undefined) =>
    state?.players.find((p) => p.id === id)?.name ?? 'Someone';
  const placeName = (index: number) => BOARD[index]?.name ?? 'a city';
  const play = (sound: keyof typeof sfx) => {
    if (store.sound) sfx[sound]();
  };

  for (const event of events) {
    switch (event.t) {
      case 'roll':
        dice = { rollId: event.rollId, values: event.dice, startedAt: performance.now() };
        play('dice');
        break;
      case 'move':
        tokens[event.playerId] = {
          index: event.to,
          // Flights and card jumps teleport; dice moves walk tile by tile.
          walk: !event.jump && event.steps !== 0 && Math.abs(event.steps) <= 12,
          steps: event.steps,
          seq: ++tokenSeq,
        };
        break;
      case 'cash':
        if (event.playerId === me && event.reason === 'Salary') {
          play('cashIn');
          queued.push({
            title: 'Payday at Start',
            detail: `+${formatCompact(event.amount)}`,
            tone: 'good',
            playerId: event.playerId,
          });
        }
        break;
      case 'build':
        play(event.bought ? 'buy' : 'build');
        queued.push({
          title:
            event.level >= HOTEL_LEVEL
              ? `${nameOf(event.playerId)} opened a hotel in ${placeName(event.tile)}`
              : event.bought
                ? `${nameOf(event.playerId)} claimed ${placeName(event.tile)}`
                : `${nameOf(event.playerId)} built in ${placeName(event.tile)}`,
          detail: formatCompact(event.cost),
          tone: 'gold',
          playerId: event.playerId,
        });
        break;
      case 'buyout':
        play('buy');
        queued.push({
          title: `${nameOf(event.playerId)} bought out ${placeName(event.tile)}`,
          detail: `${formatCompact(event.price)} to ${nameOf(event.fromId)}`,
          tone: event.fromId === me ? 'bad' : 'gold',
          playerId: event.playerId,
        });
        break;
      case 'rent':
        if (event.toId === me) play('cashIn');
        else if (event.fromId === me) play('cashOut');
        queued.push({
          title: event.shielded
            ? `${nameOf(event.fromId)} used a pass in ${placeName(event.tile)}`
            : `${nameOf(event.fromId)} paid rent in ${placeName(event.tile)}`,
          detail: event.shielded
            ? 'No rent due'
            : `${formatCompact(event.amount)} to ${nameOf(event.toId)}`,
          tone: event.toId === me ? 'good' : event.fromId === me ? 'bad' : 'info',
          playerId: event.fromId,
        });
        break;
      case 'card':
        play('card');
        cardOverlay = { text: event.text, deck: 'chance', playerId: event.playerId, at: Date.now() };
        break;
      case 'island':
        play('jail');
        queued.push({
          title: `${nameOf(event.playerId)} is stranded on the Island`,
          detail: event.reason,
          tone: 'bad',
          playerId: event.playerId,
        });
        break;
      case 'championship':
        play('win');
        queued.push({
          title: `Championship in ${placeName(event.tile)}!`,
          detail: `Rent there is now x${event.multiplier}`,
          tone: 'gold',
          playerId: event.playerId,
        });
        break;
      case 'earthquake':
        play('bankrupt');
        queued.push({
          title: `Earthquake in ${placeName(event.tile)}`,
          detail: event.level > 0 ? 'A building came down' : 'The city was levelled',
          tone: 'bad',
        });
        break;
      case 'sell':
        queued.push({
          title: `${nameOf(event.playerId)} sold ${placeName(event.tile)}`,
          detail: formatCompact(event.amount),
          tone: 'info',
          playerId: event.playerId,
        });
        break;
      case 'trade':
        if (event.status === 'open' && event.toId === me) {
          queued.push({ title: `${nameOf(event.fromId)} sent you a trade`, tone: 'info' });
        }
        if (event.status === 'accepted') queued.push({ title: 'Trade agreed', tone: 'good' });
        break;
      case 'bankrupt':
        play('bankrupt');
        queued.push({ title: `${nameOf(event.playerId)} is bankrupt`, tone: 'bad', playerId: event.playerId });
        break;
      case 'turn':
        if (event.playerId === me) play('turn');
        break;
      case 'gameover':
        play('win');
        break;
      default:
        break;
    }
  }

  set((current) => ({
    tokens,
    dice,
    cardOverlay,
    toasts: [...current.toasts, ...queued.map((t) => ({ ...t, id: ++toastSeq }))].slice(-5),
  }));
}

/* ------------------------------------------------------------ selectors */

export const selectMe = (store: GameStore) =>
  store.state?.players.find((p) => p.id === store.playerId) ?? null;

export const selectCurrent = (store: GameStore) => {
  const state = store.state;
  if (!state) return null;
  const id = state.order[state.currentIndex];
  return state.players.find((p) => p.id === id) ?? null;
};

export const selectIsMyTurn = (store: GameStore) => {
  const state = store.state;
  if (!state || !store.playerId) return false;
  return state.order[state.currentIndex] === store.playerId;
};
