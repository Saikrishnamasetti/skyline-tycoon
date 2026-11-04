import type { GameSettings, PlayerColorId, TokenShape } from './types';

export const DEFAULT_SETTINGS: GameSettings = {
  maxPlayers: 4,
  startingCash: 2_000_000,
  salary: 300_000,
  islandFee: 200_000,
  worldTourFee: 50_000,
  turnSeconds: 30,
  debtSeconds: 45,
  matchMinutes: 20,
  tradingEnabled: false,
};

export const SETTINGS_BOUNDS = {
  maxPlayers: { min: 2, max: 4, step: 1 },
  startingCash: { min: 1_000_000, max: 5_000_000, step: 250_000 },
  salary: { min: 100_000, max: 600_000, step: 50_000 },
  turnSeconds: { min: 15, max: 90, step: 5 },
  matchMinutes: { min: 0, max: 60, step: 5 },
} as const;

export const PLAYER_COLORS: {
  id: PlayerColorId;
  label: string;
  hex: string;
  glow: string;
}[] = [
  { id: 'cobalt', label: 'Cobalt', hex: '#3b82f6', glow: '#93c5fd' },
  { id: 'coral', label: 'Coral', hex: '#fb7185', glow: '#fecdd3' },
  { id: 'mint', label: 'Mint', hex: '#34d399', glow: '#a7f3d0' },
  { id: 'amber', label: 'Amber', hex: '#fbbf24', glow: '#fde68a' },
];

export const COLOR_HEX: Record<PlayerColorId, string> = Object.fromEntries(
  PLAYER_COLORS.map((c) => [c.id, c.hex]),
) as Record<PlayerColorId, string>;

export const TOKEN_SHAPES: { id: TokenShape; label: string }[] = [
  { id: 'tower', label: 'Tower' },
  { id: 'spire', label: 'Spire' },
  { id: 'dome', label: 'Dome' },
  { id: 'prism', label: 'Prism' },
];

export const BOT_NAMES = ['Ava', 'Bruno', 'Chen', 'Dara', 'Elio', 'Farah'];

/** Houses a city can hold before it is ready for a hotel. */
export const MAX_HOUSES = 3;
export const HOTEL_LEVEL = 4;
/** Before a player has completed a lap they may build at most this many houses. */
export const FIRST_LAP_HOUSES = 2;
/** Buying a rival city costs this multiple of what has been built on it. */
export const BUYOUT_MULTIPLIER = 2;
/** The bank pays this share of what was built when a player sells to it. */
export const SELL_RATE = 0.5;
/** The Tax Office takes this share of everything a player has built. */
export const TAX_RATE = 0.1;

export const MAX_LOG_ENTRIES = 120;

export const ROOM_CODE_LENGTH = 6;
/** Unambiguous alphabet - no O/0/I/1. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
