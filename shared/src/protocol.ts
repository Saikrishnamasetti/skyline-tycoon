import type { GameEvent, GameSettings, GameState, PlayerColorId, TokenShape } from './types';

/**
 * The wire contract between browser and server. Every request is answered
 * with an Ack so the UI can show exactly why something was refused.
 */

export interface Ack<T = undefined> {
  ok: boolean;
  error?: string;
  data?: T;
}

export interface JoinResult {
  roomCode: string;
  playerId: string;
  /** Opaque secret kept in localStorage; lets the same person reclaim a seat. */
  sessionToken: string;
  state: GameState;
}

export interface Identity {
  name: string;
  color: PlayerColorId;
  token: TokenShape;
}

/** Every in-game move a client can ask the server to make. */
export type GameAction =
  | { type: 'roll' }
  | { type: 'build'; level: number }
  | { type: 'skipBuild' }
  | { type: 'buyout' }
  | { type: 'skipBuyout' }
  | { type: 'hostChampionship'; tile: number }
  | { type: 'skipChampionship' }
  | { type: 'travel'; tile: number }
  | { type: 'payIslandFee' }
  | { type: 'useEscape' }
  | { type: 'sellProperty'; tile: number }
  | { type: 'settleDebt' }
  | { type: 'declareBankruptcy' }
  | {
      type: 'proposeTrade';
      toId: string;
      offerCash: number;
      requestCash: number;
      offerTiles: number[];
      requestTiles: number[];
    }
  | { type: 'respondTrade'; tradeId: string; accept: boolean }
  | { type: 'cancelTrade'; tradeId: string };

export type ActionType = GameAction['type'];

export interface ClientToServerEvents {
  'room:create': (
    payload: { identity: Identity; settings?: Partial<GameSettings> },
    ack: (res: Ack<JoinResult>) => void,
  ) => void;
  'room:join': (
    payload: { code: string; identity: Identity },
    ack: (res: Ack<JoinResult>) => void,
  ) => void;
  'room:rejoin': (
    payload: { code: string; sessionToken: string },
    ack: (res: Ack<JoinResult>) => void,
  ) => void;
  'room:leave': (ack?: (res: Ack) => void) => void;
  'room:ready': (payload: { ready: boolean }, ack?: (res: Ack) => void) => void;
  'room:identity': (payload: Partial<Identity>, ack?: (res: Ack) => void) => void;
  'room:settings': (payload: Partial<GameSettings>, ack?: (res: Ack) => void) => void;
  'room:addBot': (ack?: (res: Ack) => void) => void;
  'room:removeBot': (payload: { playerId: string }, ack?: (res: Ack) => void) => void;
  'room:start': (ack?: (res: Ack) => void) => void;
  'room:rematch': (ack?: (res: Ack) => void) => void;
  'game:action': (action: GameAction, ack?: (res: Ack) => void) => void;
}

export interface ServerToClientEvents {
  state: (state: GameState) => void;
  events: (events: GameEvent[]) => void;
  kicked: (payload: { reason: string }) => void;
}
