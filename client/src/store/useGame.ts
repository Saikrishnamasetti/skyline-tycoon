import { create } from 'zustand';
import { BOARD, HOTEL_LEVEL, eventTimeline, formatCompact, isWalkingMove } from '@shared';
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
  /** performance.now() time the walk may start: after the dice settle. */
  startAt?: number;
  /** Where the piece ends up once every move in its batch has played. */
  heading?: number;
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
  /**
   * Date.now() time the dice and the walk on screen finish. Until then the
   * player's next decision is held back so it never arrives before the piece.
   */
  movingUntil: number;

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
/** Landing effects waiting for a piece to arrive. Cleared with the room. */
let pending: number[] = [];

function cancelPending(): void {
  for (const timer of pending) window.clearTimeout(timer);
  pending = [];
}

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
  movingUntil: 0,

  setStatus: (status) => set({ status }),
  setError: (error) => set({ error }),

  applyState: (state) => {
    const tokens = { ...get().tokens };
    // Move events arrive before the state that follows them, so a piece is
    // normally already heading for its new tile. Anything still out of place
    // (first load, a reconnect, a missed event) is placed directly.
    for (const player of state.players) {
      const target = tokens[player.id];
      if (!target || (target.heading ?? target.index) !== player.position) {
        tokens[player.id] = { index: player.position, walk: false, steps: 0, seq: ++tokenSeq };
      }
    }
    set({ state, tokens, roomCode: state.roomCode });
  },

  setSeat: (roomCode, playerId) => set({ roomCode, playerId }),
  clearRoom: () => {
    cancelPending();
    set({
      state: null,
      playerId: null,
      roomCode: null,
      tokens: {},
      dice: null,
      toasts: [],
      cardOverlay: null,
      selectedTile: null,
      movingUntil: 0,
    });
  },

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
 *
 * Events play out on a timeline (see `eventTimeline`): the dice roll at once,
 * the piece sets off after they settle, and whatever happens where it lands -
 * rent, a card, a purchase - shows up when it gets there.
 */
function applyEventsImpl(set: SetFn, get: GetFn, events: GameEvent[]): void {
  const store = get();
  const { offsets, endMs } = eventTimeline(events);
  const startedAt = performance.now();
  const tokens = { ...store.tokens };
  let dice = store.dice;
  const play = (sound: keyof typeof sfx) => {
    if (get().sound) sfx[sound]();
  };

  /** Each player's final space in this batch, so applyState never snaps a chained walk. */
  const heading: Record<string, number> = {};
  const moved = new Set<string>();
  const later: { at: number; run: () => void }[] = [];

  events.forEach((event, i) => {
    const at = offsets[i];
    if (event.t === 'roll') {
      dice = { rollId: event.rollId, values: event.dice, startedAt };
      play('dice');
      return;
    }
    if (event.t === 'move') {
      heading[event.playerId] = event.to;
      const target: TokenTarget = {
        index: event.to,
        walk: isWalkingMove(event),
        steps: event.steps,
        seq: ++tokenSeq,
        startAt: startedAt + at,
      };
      if (!moved.has(event.playerId)) {
        // The first move of the batch is handed over now, with a start time.
        moved.add(event.playerId);
        tokens[event.playerId] = target;
      } else {
        // A second move (a card that sends the piece on) waits for the first,
        // plus a beat so the first hop has visibly landed.
        later.push({
          at: at + 150,
          run: () =>
            set((current) => ({
              tokens: {
                ...current.tokens,
                [event.playerId]: { ...target, seq: ++tokenSeq, startAt: 0, heading: heading[event.playerId] },
              },
            })),
        });
      }
      return;
    }
    later.push({ at, run: () => showEffect(set, get, event, play) });
  });

  for (const [playerId, index] of Object.entries(heading)) {
    if (tokens[playerId]) tokens[playerId] = { ...tokens[playerId], heading: index };
  }
  set({
    tokens,
    dice,
    movingUntil: endMs > 0 ? Math.max(store.movingUntil, Date.now() + endMs) : store.movingUntil,
  });

  for (const item of later) {
    if (item.at <= 0) {
      item.run();
    } else {
      const timer = window.setTimeout(() => {
        pending = pending.filter((t) => t !== timer);
        item.run();
      }, item.at);
      pending.push(timer);
    }
  }
}

/** What one landing event looks and sounds like. */
function showEffect(
  set: SetFn,
  get: GetFn,
  event: GameEvent,
  play: (sound: keyof typeof sfx) => void,
): void {
  const { playerId: me, state } = get();
  const nameOf = (id: string | null | undefined) =>
    state?.players.find((p) => p.id === id)?.name ?? 'Someone';
  const placeName = (index: number) => BOARD[index]?.name ?? 'a city';
  const toast = (next: Omit<Toast, 'id'>) =>
    set((current) => ({ toasts: [...current.toasts, { ...next, id: ++toastSeq }].slice(-5) }));

  switch (event.t) {
    case 'cash':
      if (event.playerId === me && event.reason === 'Salary') {
        play('cashIn');
        toast({
          title: 'Payday at Start',
          detail: `+${formatCompact(event.amount)}`,
          tone: 'good',
          playerId: event.playerId,
        });
      }
      break;
    case 'build':
      play(event.bought ? 'buy' : 'build');
      toast({
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
      toast({
        title: `${nameOf(event.playerId)} bought out ${placeName(event.tile)}`,
        detail: `${formatCompact(event.price)} to ${nameOf(event.fromId)}`,
        tone: event.fromId === me ? 'bad' : 'gold',
        playerId: event.playerId,
      });
      break;
    case 'rent':
      if (event.toId === me) play('cashIn');
      else if (event.fromId === me) play('cashOut');
      toast({
        title: event.shielded
          ? `${nameOf(event.fromId)} used a pass in ${placeName(event.tile)}`
          : `${nameOf(event.fromId)} paid rent in ${placeName(event.tile)}`,
        detail: event.shielded ? 'No rent due' : `${formatCompact(event.amount)} to ${nameOf(event.toId)}`,
        tone: event.toId === me ? 'good' : event.fromId === me ? 'bad' : 'info',
        playerId: event.fromId,
      });
      break;
    case 'card':
      play('card');
      set({ cardOverlay: { text: event.text, deck: 'chance', playerId: event.playerId, at: Date.now() } });
      break;
    case 'island':
      play('jail');
      toast({
        title: `${nameOf(event.playerId)} is stranded on the Island`,
        detail: event.reason,
        tone: 'bad',
        playerId: event.playerId,
      });
      break;
    case 'championship':
      play('win');
      toast({
        title: `Championship in ${placeName(event.tile)}!`,
        detail: `Rent there is now x${event.multiplier}`,
        tone: 'gold',
        playerId: event.playerId,
      });
      break;
    case 'earthquake':
      play('bankrupt');
      toast({
        title: `Earthquake in ${placeName(event.tile)}`,
        detail: event.level > 0 ? 'A building came down' : 'The city was levelled',
        tone: 'bad',
      });
      break;
    case 'sell':
      toast({
        title: `${nameOf(event.playerId)} sold ${placeName(event.tile)}`,
        detail: formatCompact(event.amount),
        tone: 'info',
        playerId: event.playerId,
      });
      break;
    case 'trade':
      if (event.status === 'open' && event.toId === me) {
        toast({ title: `${nameOf(event.fromId)} sent you a trade`, tone: 'info' });
      }
      if (event.status === 'accepted') toast({ title: 'Trade agreed', tone: 'good' });
      break;
    case 'bankrupt':
      play('bankrupt');
      toast({ title: `${nameOf(event.playerId)} is bankrupt`, tone: 'bad', playerId: event.playerId });
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
