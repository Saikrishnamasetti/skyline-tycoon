import { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BOARD, COLOR_HEX, GROUPS } from '@shared';
import { buildingSlots, tileTransform, tokenSlot } from '../lib/layout';
import { tileTexture } from '../lib/textures';
import { TableBase } from './TableBase';

/**
 * A lightweight, non-interactive version of the board for the landing page.
 * It shares the same geometry helpers and textures as the real table, so what
 * visitors see is genuinely the board they will play on.
 */

const DEMO_OWNERS: { index: number; color: string }[] = [
  { index: 1, color: COLOR_HEX.cobalt },
  { index: 2, color: COLOR_HEX.cobalt },
  { index: 5, color: COLOR_HEX.coral },
  { index: 10, color: COLOR_HEX.mint },
  { index: 11, color: COLOR_HEX.mint },
  { index: 19, color: COLOR_HEX.amber },
  { index: 22, color: COLOR_HEX.amber },
  { index: 23, color: COLOR_HEX.amber },
  { index: 28, color: COLOR_HEX.coral },
  { index: 31, color: COLOR_HEX.cobalt },
];

/** Building levels: 1-3 houses, 4 is a hotel. */
const DEMO_BUILDINGS: { index: number; level: number }[] = [
  { index: 22, level: 3 },
  { index: 23, level: 4 },
  { index: 1, level: 2 },
  { index: 31, level: 1 },
];

function PreviewTile({ index, ownerColor }: { index: number; ownerColor?: string }) {
  const transform = useMemo(() => tileTransform(index), [index]);
  const texture = useMemo(() => tileTexture(index), [index]);
  const width = transform.width - 0.03;
  const depth = transform.depth - 0.03;
  return (
    <group position={[transform.x, 0, transform.z]} rotation={[0, transform.rotationY, 0]}>
      <mesh castShadow receiveShadow position={[0, 0.12, 0]}>
        <boxGeometry args={[width, 0.24, depth]} />
        <meshStandardMaterial attach="material-0" color="#cdc7b6" roughness={0.85} />
        <meshStandardMaterial attach="material-1" color="#cdc7b6" roughness={0.85} />
        <meshStandardMaterial attach="material-2" map={texture} roughness={0.68} />
        <meshStandardMaterial attach="material-3" color="#e9e5da" roughness={0.9} />
        <meshStandardMaterial attach="material-4" color="#cdc7b6" roughness={0.85} />
        <meshStandardMaterial attach="material-5" color="#cdc7b6" roughness={0.85} />
      </mesh>
      {ownerColor && (
        <mesh position={[0, 0.25, depth / 2 - 0.13]}>
          <boxGeometry args={[width * 0.9, 0.06, 0.2]} />
          <meshStandardMaterial
            color={ownerColor}
            emissive={ownerColor}
            emissiveIntensity={0.9}
            roughness={0.35}
          />
        </mesh>
      )}
    </group>
  );
}

function DemoBuilding({ index, level }: { index: number; level: number }) {
  const tile = BOARD[index];
  if (tile.kind !== 'city') return null;
  const transform = tileTransform(index);
  const color = GROUPS[tile.group].color;
  const hotel = level >= 4;
  return (
    <group>
      {buildingSlots(index, hotel ? 1 : level).map(([x, z], i) => (
        <group key={i} position={[x, 0.24, z]} rotation={[0, transform.rotationY, 0]}>
          {hotel ? (
            <>
              <mesh castShadow position={[0, 0.26, 0]}>
                <boxGeometry args={[0.72, 0.52, 0.42]} />
                <meshStandardMaterial color="#f05252" roughness={0.45} />
              </mesh>
              <mesh position={[0, 0.62, 0]}>
                <boxGeometry args={[0.12, 0.14, 0.12]} />
                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.1} />
              </mesh>
            </>
          ) : (
            <>
              <mesh castShadow position={[0, 0.14, 0]}>
                <boxGeometry args={[0.28, 0.28, 0.28]} />
                <meshStandardMaterial color="#5ce08d" roughness={0.5} />
              </mesh>
              <mesh castShadow position={[0, 0.33, 0]} rotation={[0, Math.PI / 4, 0]}>
                <coneGeometry args={[0.24, 0.18, 4]} />
                <meshStandardMaterial color="#2fb673" roughness={0.55} />
              </mesh>
            </>
          )}
        </group>
      ))}
    </group>
  );
}

function DemoToken({ color, index, seat }: { color: string; index: number; seat: number }) {
  const [x, y, z] = tokenSlot(index, seat);
  const material = (
    <meshStandardMaterial
      color={color}
      emissive={color}
      emissiveIntensity={0.5}
      roughness={0.3}
      metalness={0.35}
    />
  );
  return (
    <group position={[x, y, z]}>
      <mesh castShadow position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.26, 0.3, 0.12, 18]} />
        {material}
      </mesh>
      <mesh castShadow position={[0, 0.36, 0]}>
        <boxGeometry args={[0.3, 0.5, 0.3]} />
        {material}
      </mesh>
      <mesh castShadow position={[0, 0.68, 0]}>
        <boxGeometry args={[0.2, 0.2, 0.2]} />
        {material}
      </mesh>
    </group>
  );
}

function PreviewContent() {
  const spin = useRef<THREE.Group>(null);
  const owners = useMemo(() => {
    const map: Record<number, string> = {};
    for (const item of DEMO_OWNERS) map[item.index] = item.color;
    return map;
  }, []);

  useFrame(({ clock }) => {
    if (!spin.current) return;
    spin.current.rotation.y = clock.elapsedTime * 0.12;
    spin.current.position.y = Math.sin(clock.elapsedTime * 0.7) * 0.25;
  });

  const demoSeats = [
    { color: COLOR_HEX.cobalt, index: 0 },
    { color: COLOR_HEX.coral, index: 10 },
    { color: COLOR_HEX.mint, index: 21 },
    { color: COLOR_HEX.amber, index: 27 },
  ];

  return (
    <group ref={spin}>
      <TableBase />

      {BOARD.map((tile) => (
        <PreviewTile key={tile.index} index={tile.index} ownerColor={owners[tile.index]} />
      ))}
      {DEMO_BUILDINGS.map((item) => (
        <DemoBuilding key={item.index} index={item.index} level={item.level} />
      ))}
      {demoSeats.map((seat, i) => (
        <DemoToken key={seat.color} color={seat.color} index={seat.index} seat={i} />
      ))}
    </group>
  );
}

export function PreviewScene() {
  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      camera={{ position: [0, 25, 30], fov: 36, near: 0.5, far: 200 }}
      gl={{ antialias: true, powerPreference: 'default', alpha: true }}
      style={{ pointerEvents: 'none' }}
    >
      <ambientLight intensity={0.7} />
      <hemisphereLight args={['#ffffff', '#8fb27a', 0.9]} />
      <directionalLight castShadow position={[14, 26, 12]} intensity={1.9} color="#fff4e0" />
      <Suspense fallback={null}>
        <PreviewContent />
      </Suspense>
    </Canvas>
  );
}
