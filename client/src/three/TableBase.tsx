import { useMemo } from 'react';
import { BOARD_EXTENT } from '../lib/layout';
import { centerTexture } from '../lib/textures';

/**
 * The table the board sits on: a grassy floating island with a rocky
 * underside, a wooden frame around the board, a checkered stone centre and
 * some low-poly trees and rocks around the rim. Shared by the live table and
 * the landing-page preview.
 */

const SIZE = BOARD_EXTENT;
/** Half-width of the grass top. */
const ISLAND = SIZE / 2 + 4.6;

/** Small deterministic random so the scenery never shuffles between renders. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

interface Prop {
  kind: 'tree' | 'pine' | 'rock' | 'bush';
  x: number;
  z: number;
  scale: number;
  tint: number;
}

function scatterProps(): Prop[] {
  const rand = seeded(7);
  const out: Prop[] = [];
  const inner = SIZE / 2 + 1.3;
  const outer = ISLAND - 0.8;
  for (let i = 0; i < 46; i++) {
    // Pick a point in the grass ring between the board and the island edge.
    const side = Math.floor(rand() * 4);
    const along = (rand() * 2 - 1) * outer;
    const depth = inner + rand() * (outer - inner);
    const [x, z] =
      side === 0 ? [along, depth] : side === 1 ? [-depth, along] : side === 2 ? [along, -depth] : [depth, along];
    const roll = rand();
    out.push({
      kind: roll < 0.35 ? 'tree' : roll < 0.6 ? 'pine' : roll < 0.8 ? 'bush' : 'rock',
      x,
      z,
      scale: 0.75 + rand() * 0.6,
      tint: rand(),
    });
  }
  return out;
}

const LEAF = ['#5cbf5a', '#4caf50', '#77cc66', '#3f9e4d'];

function Scenery() {
  const props = useMemo(scatterProps, []);
  return (
    <group>
      {props.map((p, i) => {
        const leaf = LEAF[Math.floor(p.tint * LEAF.length)];
        if (p.kind === 'rock') {
          return (
            <mesh key={i} castShadow position={[p.x, 0.15 * p.scale, p.z]} scale={p.scale} rotation={[0, p.tint * 6, 0]}>
              <dodecahedronGeometry args={[0.45, 0]} />
              <meshStandardMaterial color="#b9b2a6" roughness={0.95} flatShading />
            </mesh>
          );
        }
        if (p.kind === 'bush') {
          return (
            <mesh key={i} castShadow position={[p.x, 0.3 * p.scale, p.z]} scale={p.scale}>
              <icosahedronGeometry args={[0.5, 0]} />
              <meshStandardMaterial color={leaf} roughness={0.9} flatShading />
            </mesh>
          );
        }
        return (
          <group key={i} position={[p.x, 0, p.z]} scale={p.scale}>
            <mesh castShadow position={[0, 0.45, 0]}>
              <cylinderGeometry args={[0.1, 0.14, 0.9, 6]} />
              <meshStandardMaterial color="#8b5a2b" roughness={0.9} />
            </mesh>
            {p.kind === 'pine' ? (
              <mesh castShadow position={[0, 1.45, 0]}>
                <coneGeometry args={[0.6, 1.6, 7]} />
                <meshStandardMaterial color={leaf} roughness={0.85} flatShading />
              </mesh>
            ) : (
              <mesh castShadow position={[0, 1.35, 0]}>
                <icosahedronGeometry args={[0.72, 0]} />
                <meshStandardMaterial color={leaf} roughness={0.85} flatShading />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}

export function TableBase() {
  const center = useMemo(() => centerTexture(), []);
  const edge = SIZE / 2 + 0.45;
  const bar = SIZE + 1.2;

  return (
    <group>
      {/* Grass top of the floating island. */}
      <mesh receiveShadow position={[0, -0.45, 0]}>
        <boxGeometry args={[ISLAND * 2, 0.5, ISLAND * 2]} />
        <meshStandardMaterial color="#7cc96b" roughness={0.95} />
      </mesh>
      {/* A thin darker lip where grass meets rock. */}
      <mesh position={[0, -0.78, 0]}>
        <boxGeometry args={[ISLAND * 2 + 0.2, 0.2, ISLAND * 2 + 0.2]} />
        <meshStandardMaterial color="#5aa04f" roughness={1} />
      </mesh>
      {/* Rocky underside, tapering away into the sky. */}
      <mesh position={[0, -4.4, 0]} rotation={[0, Math.PI / 4, 0]}>
        <cylinderGeometry args={[ISLAND * 1.38, ISLAND * 0.45, 7, 4, 1]} />
        <meshStandardMaterial color="#a5764f" roughness={1} flatShading />
      </mesh>
      <mesh position={[0, -9.6, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[ISLAND * 0.62, 4, 4]} />
        <meshStandardMaterial color="#8a6040" roughness={1} flatShading />
      </mesh>

      {/* The board's base and wooden frame. */}
      <mesh receiveShadow position={[0, -0.1, 0]}>
        <boxGeometry args={[SIZE + 0.9, 0.3, SIZE + 0.9]} />
        <meshStandardMaterial color="#efe6d2" roughness={0.9} />
      </mesh>
      {[
        { key: 'n', position: [0, 0.05, -edge] as const, args: [bar, 0.2, 0.32] as const },
        { key: 's', position: [0, 0.05, edge] as const, args: [bar, 0.2, 0.32] as const },
        { key: 'w', position: [-edge, 0.05, 0] as const, args: [0.32, 0.2, bar] as const },
        { key: 'e', position: [edge, 0.05, 0] as const, args: [0.32, 0.2, bar] as const },
      ].map((piece) => (
        <mesh key={piece.key} castShadow receiveShadow position={[...piece.position]}>
          <boxGeometry args={[...piece.args]} />
          <meshStandardMaterial color="#c99a68" roughness={0.75} />
        </mesh>
      ))}

      {/* Checkered stone centre with the wordmark plaque. */}
      <mesh position={[0, 0.06, 0]} receiveShadow>
        <boxGeometry args={[SIZE - 5.9, 0.12, SIZE - 5.9]} />
        <meshStandardMaterial color="#d9d6d0" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.125, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[SIZE - 6.1, SIZE - 6.1]} />
        <meshStandardMaterial map={center} roughness={0.85} />
      </mesh>

      <Scenery />
    </group>
  );
}
