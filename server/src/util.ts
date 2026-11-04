import { randomBytes, randomInt, randomUUID } from 'crypto';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from './shared';

/** Cryptographically strong die. Dice are never generated on the client. */
export function rollDie(): number {
  return randomInt(1, 7);
}

export function newRoomCode(): string {
  let out = '';
  const bytes = randomBytes(ROOM_CODE_LENGTH * 2);
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    out += ROOM_CODE_ALPHABET[bytes[i] % ROOM_CODE_ALPHABET.length];
  }
  return out;
}

export function newId(): string {
  return randomUUID();
}

export function newToken(): string {
  return randomBytes(24).toString('base64url');
}

/** Fisher-Yates using the CSPRNG. */
export function shuffle<T>(input: T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Keeps player supplied strings harmless and short: strips control
 * characters and angle brackets, trims, then caps the length.
 */
export function sanitizeName(raw: unknown, fallback = 'Player'): string {
  if (typeof raw !== 'string') return fallback;
  let cleaned = '';
  for (const ch of raw) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 32 || code === 127) continue;
    if (ch === '<' || ch === '>') continue;
    cleaned += ch;
  }
  cleaned = cleaned.trim().slice(0, 16);
  return cleaned.length >= 1 ? cleaned : fallback;
}

export function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value);
}
