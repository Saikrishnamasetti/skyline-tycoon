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

const DISPLAY = 'Fredoka, Nunito, sans-serif';
const BODY = 'Nunito, sans-serif';

interface Entry {
  texture: THREE.CanvasTexture;
  /** Redraws the canvas in place, e.g. once the web fonts have arrived. */
  paint: () => void;
}

const cache = new Map<string, Entry>();

/**
 * Draws a texture once and caches it. `width` and `height` are the logical
 * size the painter works in; `scale` sets how many canvas pixels back each
 * logical one, so text stays crisp when the camera moves in close.
 */
function paintTexture(
  key: string,
  width: number,
  height: number,
  painter: (ctx: CanvasRenderingContext2D) => void,
  scale = 1,
): THREE.CanvasTexture {
  const hit = cache.get(key);
  if (hit) return hit.texture;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas is unavailable');
  const paint = () => {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, width, height);
    painter(ctx);
  };
  paint();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  cache.set(key, { texture, paint });
  return texture;
}

// A texture painted before Fredoka finished downloading was measured and
// drawn with a fallback face. Repaint everything when a font arrives.
if (typeof document !== 'undefined' && document.fonts) {
  document.fonts.addEventListener('loadingdone', () => {
    for (const entry of cache.values()) {
      entry.paint();
      entry.texture.needsUpdate = true;
    }
  });
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

interface Fit {
  size: number;
  lines: string[];
}

/**
 * The largest font size, from `max` down to `min`, at which `text` wraps into
 * at most `maxLines` lines no wider than `maxWidth`. Leaves `ctx.font` set to
 * the winning size. Returns null when even `min` does not fit.
 */
function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  opts: { weight: number; family: string; max: number; min: number; maxWidth: number; maxLines: number },
): Fit | null {
  for (let size = opts.max; size >= opts.min; size -= 1) {
    ctx.font = `${opts.weight} ${size}px ${opts.family}`;
    const lines = wrapText(ctx, text, opts.maxWidth);
    if (lines.length <= opts.maxLines && lines.every((line) => ctx.measureText(line).width <= opts.maxWidth)) {
      return { size, lines };
    }
  }
  return null;
}

/** Fits on one line if it can at a decent size, otherwise on two. */
function fitOneOrTwo(
  ctx: CanvasRenderingContext2D,
  text: string,
  opts: { weight: number; family: string; max: number; min: number; maxWidth: number; twoLineMax?: number },
): Fit {
  const single = fitText(ctx, text, { ...opts, min: Math.round(opts.max * 0.72), maxLines: 1 });
  if (single) return single;
  const double = fitText(ctx, text, { ...opts, max: opts.twoLineMax ?? opts.max, maxLines: 2 });
  if (double) return double;
  ctx.font = `${opts.weight} ${opts.min}px ${opts.family}`;
  return { size: opts.min, lines: wrapText(ctx, text, opts.maxWidth).slice(0, 2) };
}

/** Draws lines centred vertically on `centerY`. */
function drawBlock(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  centerY: number,
  lineHeight: number,
): void {
  drawLines(ctx, lines, x, centerY - ((lines.length - 1) * lineHeight) / 2, lineHeight);
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
  ctx.font = `600 78px ${DISPLAY}`;
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
  ctx.font = `800 50px ${BODY}`;
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
/**
 * Extra canvas resolution for board tiles, so their names stay sharp when the
 * camera zooms in. About 30MB of texture memory for the whole board.
 */
const TILE_SCALE = 1.5;
/**
 * Centre line of the price row. The owner's colour bar covers roughly the
 * bottom 32px of a side tile, so nothing important goes below ~365.
 */
const FOOT_Y = SIDE_H - 60;
/** Bottom edge of the coloured country band. */
const BAND_BOTTOM = 90;

/** White band text with a soft drop shadow so it reads on light bands too. */
function withBandShadow(ctx: CanvasRenderingContext2D, draw: () => void): void {
  ctx.save();
  ctx.shadowColor = 'rgba(15,23,42,0.32)';
  ctx.shadowOffsetY = 2;
  ctx.shadowBlur = 2;
  draw();
  ctx.restore();
}

function band(ctx: CanvasRenderingContext2D, color: string, label: string, flag?: GroupId): void {
  ctx.fillStyle = color;
  ctx.fillRect(6, 6, SIDE_W - 12, BAND_BOTTOM - 6);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(6, BAND_BOTTOM - 8, SIDE_W - 12, 8);
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  const text = label.toUpperCase();
  if (flag) {
    drawFlag(ctx, flag, 16, 22, 68, 46);
    const left = 96;
    const fit = fitOneOrTwo(ctx, text, {
      weight: 600,
      family: DISPLAY,
      max: 34,
      twoLineMax: 28,
      min: 16,
      maxWidth: SIDE_W - left - 16,
    });
    ctx.textAlign = 'left';
    withBandShadow(ctx, () => drawBlock(ctx, fit.lines, left, 45, fit.size * 0.98));
  } else {
    const fit = fitOneOrTwo(ctx, text, { weight: 600, family: DISPLAY, max: 36, min: 18, maxWidth: SIDE_W - 40 });
    ctx.textAlign = 'center';
    withBandShadow(ctx, () => drawBlock(ctx, fit.lines, SIDE_W / 2, 45, fit.size));
  }
  ctx.textAlign = 'center';
}

/** The space's name, as large as the room between `top` and `bottom` allows. */
function tileName(ctx: CanvasRenderingContext2D, name: string, top: number, bottom: number, max: number): void {
  const fit = fitOneOrTwo(ctx, name.toUpperCase(), {
    weight: 600,
    family: DISPLAY,
    max,
    min: 24,
    maxWidth: SIDE_W - 32,
  });
  // Two lines must also fit the height available.
  let size = fit.size;
  if (fit.lines.length * size * 1.06 > bottom - top) {
    size = Math.floor((bottom - top) / (fit.lines.length * 1.06));
    ctx.font = `600 ${size}px ${DISPLAY}`;
  }
  ctx.fillStyle = INK;
  drawBlock(ctx, fit.lines, SIDE_W / 2, (top + bottom) / 2, size * 1.06);
}

function footer(ctx: CanvasRenderingContext2D, text: string, color: string, size: number): void {
  ctx.fillStyle = color;
  ctx.font = `800 ${size}px ${BODY}`;
  ctx.fillText(text, SIDE_W / 2, FOOT_Y);
}

function paintSideTile(ctx: CanvasRenderingContext2D, tile: Tile): void {
  paper(ctx, SIDE_W, SIDE_H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Room for the name stops a little above the price row.
  const nameBottom = FOOT_Y - 32;

  if (tile.kind === 'city') {
    band(ctx, GROUPS[tile.group].color, GROUPS[tile.group].label, tile.group);
    tileName(ctx, tile.name, BAND_BOTTOM + 14, nameBottom, 56);
    footer(ctx, formatCompact(tile.houseCost), INK, 44);
  } else if (tile.kind === 'resort') {
    band(ctx, TILE_ACCENT.resort, 'Resort');
    drawPalm(ctx, SIDE_W / 2, 158, 0.74);
    tileName(ctx, tile.name, 214, nameBottom, 48);
    footer(ctx, formatCompact(tile.price), INK, 44);
  } else if (tile.kind === 'chance') {
    drawQuestion(ctx, SIDE_W / 2, 132);
    tileName(ctx, tile.name, 196, nameBottom, 50);
    footer(ctx, 'DRAW A CARD', INK_SOFT, 30);
  } else if (tile.kind === 'tax') {
    drawTaxCoin(ctx, SIDE_W / 2, 132);
    tileName(ctx, tile.name, 196, nameBottom, 50);
    footer(ctx, 'PAY 10%', TILE_ACCENT.tax, 42);
  } else {
    tileName(ctx, tile.name, BAND_BOTTOM, nameBottom, 50);
  }
}

/* -------------------------------------------------------- corner tiles */

const CORNER_PX = 448;

interface CornerSpec {
  title: string;
  caption: string;
  art: (ctx: CanvasRenderingContext2D, mid: number) => void;
}

const CORNERS: Partial<Record<Tile['kind'], CornerSpec>> = {
  start: {
    title: 'START',
    caption: 'Collect your salary',
    art: (ctx, mid) => drawArrow(ctx, mid, 142, '#2fb673'),
  },
  island: {
    title: 'ISLAND',
    caption: 'Stranded for up to 3 turns',
    art: (ctx, mid) => drawIsland(ctx, mid, 138),
  },
  championship: {
    title: 'CHAMPIONSHIP',
    caption: 'Host it, multiply rent',
    art: (ctx, mid) => drawTrophy(ctx, mid, 150),
  },
  worldtour: {
    title: 'WORLD TOUR',
    caption: 'Fly anywhere next turn',
    art: (ctx, mid) => drawPlane(ctx, mid, 142),
  },
};

function paintCornerTile(ctx: CanvasRenderingContext2D, tile: Tile): void {
  paper(ctx, CORNER_PX, CORNER_PX);
  const mid = CORNER_PX / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const spec = CORNERS[tile.kind];
  if (!spec) return;

  spec.art(ctx, mid);

  const title = fitText(ctx, spec.title, {
    weight: 600,
    family: DISPLAY,
    max: 62,
    min: 30,
    maxWidth: CORNER_PX - 40,
    maxLines: 1,
  });
  ctx.fillStyle = INK;
  if (!title) ctx.font = `600 30px ${DISPLAY}`;
  ctx.fillText(spec.title, mid, 292);

  const caption = fitOneOrTwo(ctx, spec.caption, {
    weight: 700,
    family: BODY,
    max: 32,
    twoLineMax: 30,
    min: 20,
    maxWidth: CORNER_PX - 56,
  });
  ctx.fillStyle = INK_SOFT;
  drawBlock(ctx, caption.lines, mid, caption.lines.length > 1 ? 364 : 352, caption.size * 1.12);
}

export function tileTexture(index: number): THREE.CanvasTexture {
  const tile = BOARD[index];
  const isCorner =
    tile.kind === 'start' ||
    tile.kind === 'island' ||
    tile.kind === 'championship' ||
    tile.kind === 'worldtour';
  return isCorner
    ? paintTexture(`tile-${index}`, CORNER_PX, CORNER_PX, (ctx) => paintCornerTile(ctx, tile), TILE_SCALE)
    : paintTexture(`tile-${index}`, SIDE_W, SIDE_H, (ctx) => paintSideTile(ctx, tile), TILE_SCALE);
}

/** The gold "x3" badge that floats over the championship city. */
export function championshipBadge(multiplier: number): THREE.CanvasTexture {
  return paintTexture(`badge-${multiplier}`, 256, 256, (ctx) => {
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
    ctx.font = `600 104px ${DISPLAY}`;
    ctx.fillText(`x${multiplier}`, 128, 136);
  });
}

/* ------------------------------------------------------------ centre */

export function centerTexture(): THREE.CanvasTexture {
  const size = 1024;
  return paintTexture('center', size, size, (ctx) => {
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
    ctx.font = `bold 112px ${DISPLAY}`;
    ctx.fillText('SKYLINE', size / 2, size / 2 - 66);
    const gold = ctx.createLinearGradient(0, size / 2, 0, size / 2 + 110);
    gold.addColorStop(0, '#fbbf24');
    gold.addColorStop(1, '#ea580c');
    ctx.fillStyle = gold;
    ctx.font = `bold 124px ${DISPLAY}`;
    ctx.fillText('TYCOON', size / 2, size / 2 + 52);
  });
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
  const size = 256;
  return paintTexture(`die-${value}`, size, size, (ctx) => {
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
  });
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
  for (const entry of cache.values()) entry.texture.dispose();
  cache.clear();
}
