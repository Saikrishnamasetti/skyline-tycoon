import { BOARD_SIZE, SIDE_LENGTH } from '@shared';

/**
 * Board geometry. A 22x22 square centred on the origin: four 3x3 corners and
 * seven tiles along each side. The board, tokens, buildings and markers all
 * position themselves from these helpers so they can never drift apart.
 */

export const HALF = 11;
export const CORNER = 3;
export const TILE_DEPTH = 3;
export const TILE_WIDTH = (2 * HALF - 2 * CORNER) / SIDE_LENGTH;
export const BOARD_EXTENT = HALF * 2;
export const TILE_TOP_Y = 0.24;

/** Spaces from one corner to the next, corner included. */
const PER_SIDE = SIDE_LENGTH + 1;

export type Edge = 'bottom' | 'left' | 'top' | 'right';

export interface TileTransform {
  index: number;
  x: number;
  z: number;
  rotationY: number;
  width: number;
  depth: number;
  edge: Edge;
  isCorner: boolean;
}

const INNER = HALF - CORNER;
const EDGE_CENTER = HALF - TILE_DEPTH / 2;
const EDGES: Edge[] = ['bottom', 'left', 'top', 'right'];
/** Each side turns so the tile's colour band faces the middle of the board. */
const ROTATION = [0, -Math.PI / 2, Math.PI, Math.PI / 2];

export function tileTransform(index: number): TileTransform {
  const i = ((index % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE;
  const side = Math.floor(i / PER_SIDE);
  const step = i % PER_SIDE;
  const edge = EDGES[side];
  const rotationY = ROTATION[side];

  if (step === 0) {
    const corners: [number, number][] = [
      [EDGE_CENTER, EDGE_CENTER],
      [-EDGE_CENTER, EDGE_CENTER],
      [-EDGE_CENTER, -EDGE_CENTER],
      [EDGE_CENTER, -EDGE_CENTER],
    ];
    const [x, z] = corners[side];
    return { index: i, x, z, rotationY, width: CORNER, depth: CORNER, edge, isCorner: true };
  }

  const along = INNER - (step - 0.5) * TILE_WIDTH;
  const positions: [number, number][] = [
    [along, EDGE_CENTER],
    [-EDGE_CENTER, along],
    [-along, -EDGE_CENTER],
    [EDGE_CENTER, -along],
  ];
  const [x, z] = positions[side];
  return { index: i, x, z, rotationY, width: TILE_WIDTH, depth: TILE_DEPTH, edge, isCorner: false };
}

export const TILE_TRANSFORMS: TileTransform[] = Array.from({ length: BOARD_SIZE }, (_, i) =>
  tileTransform(i),
);

/** Rotate a tile-local offset into world space. */
export function localToWorld(transform: TileTransform, localX: number, localZ: number): [number, number] {
  const cos = Math.cos(transform.rotationY);
  const sin = Math.sin(transform.rotationY);
  return [transform.x + localX * cos + localZ * sin, transform.z - localX * sin + localZ * cos];
}

/** Up to four pieces share a tile without ever overlapping. */
const SIDE_SLOTS: [number, number][] = [
  [-0.55, 0.32],
  [0.55, 0.32],
  [-0.55, 1.04],
  [0.55, 1.04],
];
const CORNER_SLOTS: [number, number][] = [
  [-0.72, 0.72],
  [0.72, 0.72],
  [-0.72, -0.62],
  [0.72, -0.62],
];

export function tokenSlot(index: number, seat: number): [number, number, number] {
  const transform = tileTransform(index);
  const slots = transform.isCorner ? CORNER_SLOTS : SIDE_SLOTS;
  const [lx, lz] = slots[seat % slots.length];
  const [x, z] = localToWorld(transform, lx, lz);
  return [x, TILE_TOP_Y, z];
}

/** A point part of the way between two tiles, with a hop, for walking. */
export function walkPoint(from: number, to: number, t: number, seat: number): [number, number, number] {
  const a = tokenSlot(from, seat);
  const b = tokenSlot(to, seat);
  const k = Math.min(1, Math.max(0, t));
  const hop = Math.sin(k * Math.PI) * 0.75;
  return [a[0] + (b[0] - a[0]) * k, TILE_TOP_Y + hop, a[2] + (b[2] - a[2]) * k];
}

/** Where houses stand: along the inner lip of the lot. */
export function buildingSlots(index: number, count: number): [number, number][] {
  const transform = tileTransform(index);
  if (count <= 0) return [];
  if (count === 1) return [localToWorld(transform, 0, -1.02)];
  const spread = transform.width * 0.58;
  return Array.from({ length: count }, (_, i) =>
    localToWorld(transform, -spread / 2 + (spread / (count - 1)) * i, -1.02),
  );
}

/** The middle of a tile at a given height, for floating markers. */
export function tileCenter(index: number, height: number): [number, number, number] {
  const t = tileTransform(index);
  return [t.x, height, t.z];
}
