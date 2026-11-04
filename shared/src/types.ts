/**
 * Skyline Tycoon - shared game-state schema.
 *
 * The rules follow the Business Tour style of play: build on the spot when
 * you land, buy rivals out, host championships, fly with World Tour, and win
 * instantly with a side, triple or resort monopoly. Everything here is plain
 * JSON so the whole GameState travels over Socket.IO and onto disk as-is.
 */

/* ------------------------------------------------------------------ board */

export type GroupId =
  | 'egypt'
  | 'brazil'
  | 'turkey'
  | 'spain'
  | 'italy'
  | 'germany'
  | 'britain'
  | 'japan';

export interface GroupMeta {
  id: GroupId;
  label: string;
  color: string;
}

export type TileKind =
  | 'start'
  | 'city'
  | 'resort'
  | 'chance'
  | 'tax'
  | 'island'
  | 'championship'
  | 'worldtour';

export interface CityTile {
  index: number;
  kind: 'city';
  name: string;
  group: GroupId;
  /** Cost of each of the three houses. */
  houseCost: number;
  /** Cost of the hotel that replaces three houses. */
  hotelCost: number;
  /** Rent at [1 house, 2 houses, 3 houses, hotel]. */
  rent: [number, number, number, number];
}

export interface ResortTile {
  index: number;
  kind: 'resort';
  name: string;
  price: number;
}

export interface SpecialTile {
  index: number;
  kind: 'start' | 'chance' | 'tax' | 'island' | 'championship' | 'worldtour';
  name: string;
}

export type Tile = CityTile | ResortTile | SpecialTile;
export type OwnableTile = CityTile | ResortTile;

/* ------------------------------------------------------------------ cards */

export type CardEffect =
  | { kind: 'cash'; amount: number }
  | { kind: 'collect_each'; amount: number }
  | { kind: 'pay_each'; amount: number }
  | { kind: 'move_to'; index: number; collectSalary: boolean }
  | { kind: 'move_relative'; steps: number }
  | { kind: 'next_resort' }
  | { kind: 'go_to_island' }
  | { kind: 'escape_card' }
  | { kind: 'shield_card' }
  | { kind: 'earthquake' }
  | { kind: 'host_championship' };

export interface Card {
  id: string;
  text: string;
  effect: CardEffect;
}

/* ---------------------------------------------------------------- players */

export type PlayerColorId = 'cobalt' | 'coral' | 'mint' | 'amber';
export type TokenShape = 'tower' | 'spire' | 'dome' | 'prism';

export interface Player {
  id: string;
  name: string;
  color: PlayerColorId;
  token: TokenShape;
  seat: number;
  cash: number;
  position: number;
  /** Completed laps. A third house needs at least one. */
  laps: number;
  onIsland: boolean;
  /** Failed escape rolls so far on this stay. */
  islandTurns: number;
  escapeCards: number;
  /** Each one waives a single rent payment. */
  shieldCards: number;
  /** Landed on World Tour: may fly anywhere at the start of the next turn. */
  travelPending: boolean;
  isBot: boolean;
  bankrupt: boolean;
  connected: boolean;
  ready: boolean;
  joinedAt: number;
}

/* --------------------------------------------------------------- holdings */

export interface Holding {
  owner: string | null;
  /**
   * Cities: 0 = empty, 1-3 = houses, 4 = hotel.
   * Resorts: 0 = unowned, 1 = owned.
   */
  level: number;
}

export interface BuildOption {
  level: number;
  /** What this choice costs on top of what is already built. */
  cost: number;
}

export interface BuildOffer {
  playerId: string;
  tile: number;
  mode: 'buy' | 'upgrade';
  currentLevel: number;
  options: BuildOption[];
}

export interface BuyoutOffer {
  playerId: string;
  tile: number;
  fromId: string;
  price: number;
}

export interface ChampionshipOffer {
  playerId: string;
}

export interface Championship {
  /** The city currently hosting, or null before the first one. */
  tile: number | null;
  /** Championships held so far. The host earns rent x (1 + level). */
  level: number;
}

export interface PendingDebt {
  debtorId: string;
  /** Single creditor, or null when the bank is owed. */
  creditorId: string | null;
  amount: number;
  reason: string;
  /** Set when one obligation is split across several rivals. */
  distribute?: { playerIds: string[]; each: number };
}

export type TradeStatus = 'open' | 'accepted' | 'declined' | 'cancelled' | 'void';

export interface TradeOffer {
  id: string;
  fromId: string;
  toId: string;
  offerCash: number;
  requestCash: number;
  offerTiles: number[];
  requestTiles: number[];
  status: TradeStatus;
  createdAt: number;
}

/* ----------------------------------------------------------------- phases */

export type GamePhase =
  | 'lobby'
  | 'pre_roll'
  | 'build'
  | 'buyout'
  | 'championship'
  | 'in_debt'
  | 'game_over';

export type GameStatus = 'lobby' | 'playing' | 'finished';

export type WinReason = 'bankruptcy' | 'side' | 'triple' | 'resort' | 'time';

/* --------------------------------------------------------------- settings */

export interface GameSettings {
  maxPlayers: number;
  startingCash: number;
  /** Paid every time a player passes or lands on Start. */
  salary: number;
  islandFee: number;
  worldTourFee: number;
  turnSeconds: number;
  debtSeconds: number;
  /** Match length; when it runs out the richest player wins. 0 = no limit. */
  matchMinutes: number;
  /** House rule: allow deals between players. Off in the classic game. */
  tradingEnabled: boolean;
}

/* -------------------------------------------------------------------- log */

export type LogKind =
  | 'system'
  | 'roll'
  | 'money'
  | 'property'
  | 'card'
  | 'island'
  | 'trade'
  | 'danger'
  | 'win';

export interface LogEntry {
  id: number;
  ts: number;
  text: string;
  kind: LogKind;
  playerId?: string;
}

/* ------------------------------------------------------------------ state */

export interface GameState {
  roomCode: string;
  status: GameStatus;
  hostId: string;
  settings: GameSettings;

  players: Player[];
  /** Player ids in turn order (empty until the game starts). */
  order: string[];
  currentIndex: number;
  turnCount: number;

  phase: GamePhase;
  dice: [number, number] | null;
  /** Increments on every roll so the client can trigger a fresh animation. */
  rollId: number;
  doublesCount: number;
  lastDoubles: boolean;

  holdings: Record<number, Holding>;
  championship: Championship;

  buildOffer: BuildOffer | null;
  buyoutOffer: BuyoutOffer | null;
  championshipOffer: ChampionshipOffer | null;
  pendingDebt: PendingDebt | null;
  trades: TradeOffer[];

  /** Chance card ids, top of the deck first. */
  deck: string[];
  lastCard: { text: string; playerId: string; at: number } | null;

  log: LogEntry[];
  /** Epoch ms after which the server decides for the current player. */
  deadline: number | null;
  startedAt: number | null;
  /** Epoch ms when the match clock runs out, if there is one. */
  endsAt: number | null;
  winnerId: string | null;
  winReason: WinReason | null;
  version: number;
  createdAt: number;
}

/* ----------------------------------------------------------------- events */

export type GameEvent =
  | { t: 'roll'; playerId: string; dice: [number, number]; rollId: number }
  | {
      t: 'move';
      playerId: string;
      from: number;
      to: number;
      steps: number;
      passedStart: boolean;
      /** True for World Tour flights and card jumps: no walking. */
      jump: boolean;
    }
  | { t: 'cash'; playerId: string; amount: number; reason: string }
  | { t: 'build'; playerId: string; tile: number; level: number; cost: number; bought: boolean }
  | { t: 'buyout'; playerId: string; fromId: string; tile: number; price: number }
  | { t: 'rent'; fromId: string; toId: string; amount: number; tile: number; shielded: boolean }
  | { t: 'card'; playerId: string; text: string }
  | { t: 'island'; playerId: string; reason: string }
  | { t: 'free'; playerId: string; how: string }
  | { t: 'championship'; playerId: string; tile: number; multiplier: number }
  | { t: 'earthquake'; tile: number; level: number }
  | { t: 'sell'; playerId: string; tile: number; amount: number }
  | { t: 'trade'; tradeId: string; status: TradeStatus; fromId: string; toId: string }
  | { t: 'bankrupt'; playerId: string; creditorId: string | null }
  | { t: 'turn'; playerId: string }
  | { t: 'gameover'; winnerId: string | null; reason: WinReason }
  | { t: 'info'; text: string };
