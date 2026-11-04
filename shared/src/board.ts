import type { CityTile, GroupId, GroupMeta, ResortTile, Tile } from './types';

/**
 * A 32-space world tour. Four corners, and seven spaces along each side:
 * two countries (one pair, one trio), a resort, and a Chance or Tax space.
 * Prices rise clockwise from Start, so the last side is the costliest.
 */

export const GROUPS: Record<GroupId, GroupMeta> = {
  egypt: { id: 'egypt', label: 'Egypt', color: '#c9934a' },
  brazil: { id: 'brazil', label: 'Brazil', color: '#3fbf6f' },
  turkey: { id: 'turkey', label: 'Turkey', color: '#e05a5a' },
  spain: { id: 'spain', label: 'Spain', color: '#f2b631' },
  italy: { id: 'italy', label: 'Italy', color: '#2fb5a8' },
  germany: { id: 'germany', label: 'Germany', color: '#8a7cf0' },
  britain: { id: 'britain', label: 'United Kingdom', color: '#3d8bf0' },
  japan: { id: 'japan', label: 'Japan', color: '#ef5fa7' },
};

export const GROUP_ORDER: GroupId[] = [
  'egypt',
  'brazil',
  'turkey',
  'spain',
  'italy',
  'germany',
  'britain',
  'japan',
];

export const TILE_ACCENT = {
  resort: '#21c4d6',
  chance: '#b48cff',
  tax: '#ef6a6a',
} as const;

/** Rent for owning 1, 2 or 3 resorts. Four resorts wins outright. */
export const RESORT_RENT: [number, number, number] = [100_000, 250_000, 600_000];

/** Rent at each building level, as a multiple of the city's house cost. */
const RENT_FACTOR: [number, number, number, number] = [0.5, 1.5, 4, 7];

function city(index: number, name: string, group: GroupId, houseCost: number): CityTile {
  return {
    index,
    kind: 'city',
    name,
    group,
    houseCost,
    hotelCost: houseCost * 2,
    rent: RENT_FACTOR.map((f) => Math.round((houseCost * f) / 1000) * 1000) as [
      number,
      number,
      number,
      number,
    ],
  };
}

function resort(index: number, name: string, price: number): ResortTile {
  return { index, kind: 'resort', name, price };
}

export const START_INDEX = 0;
export const ISLAND_INDEX = 8;
export const CHAMPIONSHIP_INDEX = 16;
export const WORLD_TOUR_INDEX = 24;

export const BOARD: Tile[] = [
  { index: 0, kind: 'start', name: 'Start' },
  city(1, 'Cairo', 'egypt', 60_000),
  city(2, 'Luxor', 'egypt', 60_000),
  { index: 3, kind: 'chance', name: 'Chance' },
  city(4, 'Salvador', 'brazil', 80_000),
  city(5, 'Rio de Janeiro', 'brazil', 80_000),
  resort(6, 'Cancun', 150_000),
  city(7, 'Sao Paulo', 'brazil', 100_000),

  { index: 8, kind: 'island', name: 'Island' },
  city(9, 'Izmir', 'turkey', 110_000),
  city(10, 'Istanbul', 'turkey', 120_000),
  resort(11, 'Bali', 200_000),
  city(12, 'Seville', 'spain', 140_000),
  { index: 13, kind: 'chance', name: 'Chance' },
  city(14, 'Barcelona', 'spain', 140_000),
  city(15, 'Madrid', 'spain', 160_000),

  { index: 16, kind: 'championship', name: 'Championship' },
  city(17, 'Naples', 'italy', 180_000),
  city(18, 'Milan', 'italy', 180_000),
  city(19, 'Rome', 'italy', 200_000),
  { index: 20, kind: 'chance', name: 'Chance' },
  resort(21, 'Santorini', 250_000),
  city(22, 'Munich', 'germany', 220_000),
  city(23, 'Berlin', 'germany', 240_000),

  { index: 24, kind: 'worldtour', name: 'World Tour' },
  city(25, 'Manchester', 'britain', 260_000),
  city(26, 'Edinburgh', 'britain', 260_000),
  resort(27, 'Maldives', 300_000),
  city(28, 'London', 'britain', 280_000),
  { index: 29, kind: 'tax', name: 'Tax Office' },
  city(30, 'Osaka', 'japan', 320_000),
  city(31, 'Tokyo', 'japan', 350_000),
];

export const BOARD_SIZE = BOARD.length;
/** Spaces between two corners. */
export const SIDE_LENGTH = 7;

/** The city spaces on each of the four sides, used for a side monopoly. */
export const SIDES: number[][] = [0, 1, 2, 3].map((side) =>
  BOARD.filter(
    (t) => t.kind === 'city' && t.index > side * 8 && t.index < side * 8 + 8,
  ).map((t) => t.index),
);

export const RESORT_INDEXES: number[] = BOARD.filter((t) => t.kind === 'resort').map(
  (t) => t.index,
);
