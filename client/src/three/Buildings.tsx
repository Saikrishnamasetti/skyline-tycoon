import { useMemo } from 'react';
import { BOARD, GROUPS, HOTEL_LEVEL } from '@shared';
import type { GameState } from '@shared';
import { buildingSlots, tileCenter, tileTransform } from '../lib/layout';

interface BuildingsProps {
  state: GameState;
}

interface Placement {
  key: string;
  x: number;
  z: number;
  rotationY: number;
  hotel: boolean;
  color: string;
  roof: string;
}

/**
 * Houses and hotels, drawn straight from the authoritative holdings so a
 * building can never appear before the server agreed to it. One to three
 * houses stand along the lot; a hotel replaces them with a single tower.
 */
export function Buildings({ state }: BuildingsProps) {
  const placements = useMemo(() => {
    const out: Placement[] = [];
    for (const tile of BOARD) {
      if (tile.kind !== 'city') continue;
      const holding = state.holdings[tile.index];
      if (!holding?.owner || holding.level < 1) continue;
      const transform = tileTransform(tile.index);
      const color = GROUPS[tile.group].color;
      const owner = state.players.find((p) => p.id === holding.owner);
      const roof = owner ? ownerRoof(owner.color) : '#94a3b8';
      if (holding.level >= HOTEL_LEVEL) {
        const [x, , z] = tileCenter(tile.index, 0);
        const [sx, sz] = buildingSlots(tile.index, 1)[0];
        out.push({
          key: `${tile.index}-hotel`,
          x: (x + sx) / 2,
          z: (z + sz) / 2,
          rotationY: transform.rotationY,
          hotel: true,
          color,
          roof,
        });
        continue;
      }
      buildingSlots(tile.index, holding.level).forEach(([x, z], i) => {
        out.push({
          key: `${tile.index}-${i}`,
          x,
          z,
          rotationY: transform.rotationY,
          hotel: false,
          color,
          roof,
        });
      });
    }
    return out;
  }, [state.holdings, state.players]);

  return (
    <group>
      {placements.map((item) =>
        item.hotel ? (
          <group key={item.key} position={[item.x, 0.24, item.z]} rotation={[0, item.rotationY, 0]}>
            <mesh castShadow position={[0, 0.55, 0]}>
              <boxGeometry args={[0.8, 1.1, 0.6]} />
              <meshStandardMaterial color="#eef2fb" roughness={0.35} metalness={0.15} />
            </mesh>
            {[0.3, 0.6, 0.9].map((y) => (
              <mesh key={y} position={[0, y, 0.305]}>
                <planeGeometry args={[0.64, 0.12]} />
                <meshStandardMaterial color="#7ec8ff" emissive="#7ec8ff" emissiveIntensity={0.6} />
              </mesh>
            ))}
            <mesh castShadow position={[0, 1.18, 0]}>
              <boxGeometry args={[0.9, 0.14, 0.7]} />
              <meshStandardMaterial color={item.roof} roughness={0.4} />
            </mesh>
            <mesh position={[0, 1.36, 0]}>
              <boxGeometry args={[0.14, 0.24, 0.14]} />
              <meshStandardMaterial color={item.color} emissive={item.color} emissiveIntensity={1.2} />
            </mesh>
          </group>
        ) : (
          <group key={item.key} position={[item.x, 0.24, item.z]} rotation={[0, item.rotationY, 0]}>
            <mesh castShadow position={[0, 0.16, 0]}>
              <boxGeometry args={[0.34, 0.32, 0.34]} />
              <meshStandardMaterial color="#f4efe4" roughness={0.6} />
            </mesh>
            <mesh castShadow position={[0, 0.4, 0]} rotation={[0, Math.PI / 4, 0]}>
              <coneGeometry args={[0.3, 0.2, 4]} />
              <meshStandardMaterial color={item.roof} roughness={0.5} />
            </mesh>
          </group>
        ),
      )}
    </group>
  );
}

/** Roofs take the owner's colour so a glance shows whose street it is. */
function ownerRoof(color: string): string {
  const roofs: Record<string, string> = {
    cobalt: '#3b82f6',
    coral: '#fb7185',
    mint: '#34d399',
    amber: '#fbbf24',
  };
  return roofs[color] ?? '#94a3b8';
}
