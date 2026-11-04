import * as THREE from 'three';
import { BOARD, GROUPS, TILE_ACCENT, formatCompact } from '@shared';
import type { GroupId, Tile } from '@shared';
import { drawFlag } from './flags';

/**
 * Every graphic on the board is drawn here with the Canvas 2D API and
 * uploaded as a texture. Nothing is fetched at runtime, so the board renders
 * identically offline and there are no third-party art assets involved.
 */

const PAPER = '#f2efe6';
const PAPER_EDGE = '#ddd7c7';
const INK = '#18213a';
const INK_SOFT = '#5b678a';

const cache = new Map<string, THREE.CanvasTexture>();

function makeCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas is unavailable');
  return { canvas, ctx };
}

function finish(canvas: HTMLCanvasElement, key: string): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  cache.set(key, texture);
  return texture;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  centerX: number,
  startY: number,
  lineHeight: number,
): void {
  lines.forEach((line, i) => ctx.fillText(line, centerX, startY + i * lineHeight));
}

function paper(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, w, h);
  // A faint vignette keeps the flat colour from looking like plastic.
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, 'rgba(0,0,0,0.05)');
  gradient.addColorStop(0.35, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.07)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = PAPER_EDGE;
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, w - 4, h - 4);
}

/* ------------------------------------------------------------- glyphs */

function drawPalm(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale = 1): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.fillStyle = '#f4d58d';
  ctx.beginPath();
  ctx.ellipse(0, 46, 58, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#8a5a2b';
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(6, 44);
  ctx.quadraticCurveTo(-4, 6, 4, -30);
  ctx.stroke();
  ctx.fillStyle = TILE_ACCENT.resort;
  for (const angle of [-2.6, -1.9, -1.2, -0.5, 0.2]) {
    ctx.save();
    ctx.translate(4, -30);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.ellipse(28, 0, 30, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawQuestion(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  ctx.fillStyle = TILE_ACCENT.chance;
  roundRect(ctx, cx - 50, cy - 50, 100, 100, 22);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '600 78px Fredoka, Nunito, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', cx, cy + 4);
}

function drawTaxCoin(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  ctx.fillStyle = TILE_ACCENT.tax;
  ctx.beginPath();
  ctx.arc(cx, cy, 48, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 50px Nunito, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('%', cx, cy + 2);
}

function drawArrow(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-84, -22);
  ctx.lineTo(30, -22);
  ctx.lineTo(30, -54);
  ctx.lineTo(92, 0);
  ctx.lineTo(30, 54);
  ctx.lineTo(30, 22);
  ctx.lineTo(-84, 22);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawIsland(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  ctx.fillStyle = '#5fb7e8';
  ctx.beginPath();
  ctx.arc(cx, cy, 86, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 5;
  for (const y of [cy + 36, cy + 56]) {
    ctx.beginPath();
    ctx.moveTo(cx - 60, y);
    ctx.quadraticCurveTo(cx - 30, y - 10, cx, y);
    ctx.quadraticCurveTo(cx + 30, y + 10, cx + 60, y);
    ctx.stroke();
  }
  drawPalm(ctx, cx, cy - 12, 0.9);
}

function drawTrophy(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  ctx.fillStyle = '#f2b631';
  ctx.beginPath();
  ctx.moveTo(cx - 56, cy - 70);
  ctx.lineTo(cx + 56, cy - 70);
  ctx.quadraticCurveTo(cx + 54, cy + 4, cx, cy + 16);
  ctx.quadraticCurveTo(cx - 54, cy + 4, cx - 56, cy - 70);
  ctx.fill();
  ctx.strokeStyle = '#f2b631';
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.arc(cx - 58, cy - 40, 24, Math.PI * 0.5, Math.PI * 1.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx + 58, cy - 40, 24, Math.PI * 1.5, Math.PI * 0.5);
  ctx.stroke();
  ctx.fillRect(cx - 10, cy + 14, 20, 30);
  ctx.fillStyle = '#c98f1c';
  roundRect(ctx, cx - 44, cy + 42, 88, 22, 6);
  ctx.fill();
}

function drawPlane(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-Math.PI / 6);
  ctx.fillStyle = '#3d8bf0';
  roundRect(ctx, -90, -14, 180, 28, 14);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-10, -12);
  ctx.lineTo(30, -74);
  ctx.lineTo(48, -74);
  ctx.lineTo(30, -12);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-10, 12);
  ctx.lineTo(30, 74);
  ctx.lineTo(48, 74);
  ctx.lineTo(30, 12);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-84, -10);
  ctx.lineTo(-70, -40);
  ctx.lineTo(-58, -40);
  ctx.lineTo(-62, -10);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/* --------------------------------------------------------- side tiles */

/** Matches the 2.29 x 3 footprint of a side tile. */
const SIDE_W = 304;
const SIDE_H = 400;

function band(ctx: CanvasRenderingContext2D, color: string, label: string, flag?: GroupId): void {
  ctx.fillStyle = color;
  ctx.fillRect(6, 6, SIDE_W - 12, 84);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(6, 82, SIDE_W - 12, 8);
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  if (flag) {
    drawFlag(ctx, flag, 18, 24, 64, 42);
    ctx.textAlign = 'left';
    let size = 26;
    do {
      ctx.font = `600 ${size}px Fredoka, Nunito, sans-serif`;
      size -= 1;
    } while (ctx.measureText(label.toUpperCase()).width > SIDE_W - 112 && size > 14);
    ctx.fillText(label.toUpperCase(), 94, 47);
  } else {
    ctx.textAlign = 'center';
    ctx.font = '600 26px Fredoka, Nunito, sans-serif';
    ctx.fillText(label.toUpperCase(), SIDE_W / 2, 47);
  }
  ctx.textAlign = 'center';
}

function drawSideTile(tile: Tile): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(SIDE_W, SIDE_H);
  paper(ctx, SIDE_W, SIDE_H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  let nameTop = 150;
  let price: number | null = null;

  if (tile.kind === 'city') {
    band(ctx, GROUPS[tile.group].color, GROUPS[tile.group].label, tile.group);
    price = tile.houseCost;
    nameTop = 168;
  } else if (tile.kind === 'resort') {
    band(ctx, TILE_ACCENT.resort, 'Resort');
    drawPalm(ctx, SIDE_W / 2, 176, 0.85);
    price = tile.price;
    nameTop = 270;
  } else if (tile.kind === 'chance') {
    drawQuestion(ctx, SIDE_W / 2, 130);
    nameTop = 236;
  } else if (tile.kind === 'tax') {
    drawTaxCoin(ctx, SIDE_W / 2, 130);
    nameTop = 236;
  }

  ctx.fillStyle = INK;
  ctx.font = '600 36px Fredoka, Nunito, sans-serif';
  const lines = wrapText(ctx, tile.name.toUpperCase(), SIDE_W - 36);
  drawLines(ctx, lines.slice(0, 2), SIDE_W / 2, nameTop, 38);

  ctx.font = '700 30px Nunito, sans-serif';
  if (price !== null) {
    ctx.fillStyle = INK_SOFT;
    ctx.fillText(formatCompact(price), SIDE_W / 2, SIDE_H - 40);
  } else if (tile.kind === 'tax') {
    ctx.fillStyle = TILE_ACCENT.tax;
    ctx.fillText('PAY 10%', SIDE_W / 2, SIDE_H - 40);
  } else if (tile.kind === 'chance') {
    ctx.fillStyle = INK_SOFT;
    ctx.font = '700 22px Nunito, sans-serif';
    ctx.fillText('DRAW A CARD', SIDE_W / 2, SIDE_H - 40);
  }
  return canvas;
}

/* -------------------------------------------------------- corner tiles */

const CORNER_PX = 448;

function drawCornerTile(tile: Tile): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(CORNER_PX, CORNER_PX);
  paper(ctx, CORNER_PX, CORNER_PX);
  const mid = CORNER_PX / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const title = (text: string) => {
    ctx.fillStyle = INK;
    ctx.font = '600 46px Fredoka, Nunito, sans-serif';
    ctx.fillText(text, mid, 300);
  };
  const caption = (text: string) => {
    ctx.fillStyle = INK_SOFT;
    ctx.font = '700 24px Nunito, sans-serif';
    ctx.fillText(text, mid, 356);
  };

  if (tile.kind === 'start') {
    drawArrow(ctx, mid, 150, '#2fb673');
    title('START');
    caption('Collect your salary');
  } else if (tile.kind === 'island') {
    drawIsland(ctx, mid, 150);
    title('ISLAND');
    caption('Stranded for up to 3 turns');
  } else if (tile.kind === 'championship') {
    drawTrophy(ctx, mid, 158);
    title('CHAMPIONSHIP');
    caption('Host it, multiply rent');
  } else {
    drawPlane(ctx, mid, 150);
    title('WORLD TOUR');
    caption('Fly anywhere next turn');
  }
  return canvas;
}

export function tileTexture(index: number): THREE.CanvasTexture {
  const key = `tile-${index}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const tile = BOARD[index];
  const isCorner =
    tile.kind === 'start' ||
    tile.kind === 'island' ||
    tile.kind === 'championship' ||
    tile.kind === 'worldtour';
  return finish(isCorner ? drawCornerTile(tile) : drawSideTile(tile), key);
}

/** The gold "x3" badge that floats over the championship city. */
export function championshipBadge(multiplier: number): THREE.CanvasTexture {
  const key = `badge-${multiplier}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const { canvas, ctx } = makeCanvas(256, 256);
  const gradient = ctx.createRadialGradient(128, 110, 20, 128, 128, 124);
  gradient.addColorStop(0, '#fff1b8');
  gradient.addColorStop(1, '#e9a515');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(128, 128, 120, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 10;
  ctx.stroke();
  ctx.fillStyle = '#5a3a00';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '600 104px Fredoka, Nunito, sans-serif';
  ctx.fillText(`x${multiplier}`, 128, 136);
  return finish(canvas, key);
}

/* ------------------------------------------------------------ centre */

export function centerTexture(): THREE.CanvasTexture {
  const key = 'center';
  const hit = cache.get(key);
  if (hit) return hit;
  const size = 1024;
  const { canvas, ctx } = makeCanvas(size, size);

  // Checkered stone floor.
  const cells = 8;
  const cell = size / cells;
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#e7e4de' : '#c9c5bd';
      ctx.fillRect(x * cell, y * cell, cell, cell);
      ctx.strokeStyle = 'rgba(0,0,0,0.06)';
      ctx.lineWidth = 3;
      ctx.strokeRect(x * cell + 1.5, y * cell + 1.5, cell - 3, cell - 3);
    }
  }

  // Cream plaque with the wordmark.
  ctx.fillStyle = 'rgba(30,41,59,0.18)';
  roundRect(ctx, 166, size / 2 - 150, size - 332, 312, 46);
  ctx.fill();
  ctx.fillStyle = '#fffaf0';
  roundRect(ctx, 160, size / 2 - 160, size - 320, 300, 44);
  ctx.fill();
  ctx.strokeStyle = '#e9c27a';
  ctx.lineWidth = 10;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#0ea5e9';
  ctx.font = 'bold 112px Fredoka, Nunito, sans-serif';
  ctx.fillText('SKYLINE', size / 2, size / 2 - 66);
  const gold = ctx.createLinearGradient(0, size / 2, 0, size / 2 + 110);
  gold.addColorStop(0, '#fbbf24');
  gold.addColorStop(1, '#ea580c');
  ctx.fillStyle = gold;
  ctx.font = 'bold 124px Fredoka, Nunito, sans-serif';
  ctx.fillText('TYCOON', size / 2, size / 2 + 52);

  return finish(canvas, key);
}

/* -------------------------------------------------------------- dice */

/** Pip layout per face, in a 3x3 grid of unit positions. */
const PIPS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [
    [0, 0],
    [2, 2],
  ],
  3: [
    [0, 0],
    [1, 1],
    [2, 2],
  ],
  4: [
    [0, 0],
    [2, 0],
    [0, 2],
    [2, 2],
  ],
  5: [
    [0, 0],
    [2, 0],
    [1, 1],
    [0, 2],
    [2, 2],
  ],
  6: [
    [0, 0],
    [2, 0],
    [0, 1],
    [2, 1],
    [0, 2],
    [2, 2],
  ],
};

export function dieFaceTexture(value: number): THREE.CanvasTexture {
  const key = `die-${value}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const size = 256;
  const { canvas, ctx } = makeCanvas(size, size);

  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(1, '#dfe6f5');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(24,33,58,0.12)';
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, size - 8, size - 8);

  const pad = 62;
  const step = (size - pad * 2) / 2;
  ctx.fillStyle = '#18213a';
  for (const [gx, gy] of PIPS[value] ?? []) {
    ctx.beginPath();
    ctx.arc(pad + gx * step, pad + gy * step, 24, 0, Math.PI * 2);
    ctx.fill();
  }
  return finish(canvas, key);
}

/**
 * Face order matches THREE.BoxGeometry material slots:
 * +X, -X, +Y, -Y, +Z, -Z. Opposite faces always sum to seven.
 */
export const DIE_FACE_VALUES = [1, 6, 2, 5, 3, 4];

/** Euler angles that bring a given value to the top of the die. */
export const DIE_REST_ROTATION: Record<number, [number, number, number]> = {
  1: [0, 0, Math.PI / 2],
  2: [0, 0, 0],
  3: [-Math.PI / 2, 0, 0],
  4: [Math.PI / 2, 0, 0],
  5: [Math.PI, 0, 0],
  6: [0, 0, -Math.PI / 2],
};

export function disposeTextures(): void {
  for (const texture of cache.values()) texture.dispose();
  cache.clear();
}
