/**
 * Browser stand-in for server/src/util.ts, swapped in by the Vite config when
 * the server modules are bundled into the static build. Same exports, backed
 * by Web Crypto instead of Node's crypto module.
 */
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@shared';

const cryptoApi: Crypto = globalThis.crypto;

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  cryptoApi.getRandomValues(bytes);
  return bytes;
}

/** Unbiased integer in [min, max), rejection sampled like Node's randomInt. */
function randomInt(min: number, max: number): number {
  const range = max - min;
  if (range <= 0) return min;
  const limit = Math.floor(0x100000000 / range) * range;
  const buf = new Uint32Array(1);
  for (;;) {
    cryptoApi.getRandomValues(buf);
    if (buf[0] < limit) return min + (buf[0] % range);
  }
}

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
  if (typeof cryptoApi.randomUUID === 'function') return cryptoApi.randomUUID();
  const b = randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function newToken(): string {
  let binary = '';
  for (const byte of randomBytes(24)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

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
