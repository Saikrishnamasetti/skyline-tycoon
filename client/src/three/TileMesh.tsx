import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BOARD } from '@shared';
import { tileTransform } from '../lib/layout';
import { tileTexture } from '../lib/textures';

interface TileMeshProps {
  index: number;
  ownerColor?: string;
  /** A piece belonging to the player whose turn it is stands here. */
  active: boolean;
  selected: boolean;
  /** A valid pick right now (a World Tour destination, a host city). */
  selectable: boolean;
  onSelect: (index: number) => void;
}

const BODY_COLOR = '#e9e5da';
const EDGE_COLOR = '#cdc7b6';

export function TileMesh({
  index,
  ownerColor,
  active,
  selected,
  selectable,
  onSelect,
}: TileMeshProps) {
  const transform = useMemo(() => tileTransform(index), [index]);
  const texture = useMemo(() => tileTexture(index), [index]);
  const tile = BOARD[index];
  const halo = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!halo.current) return;
    const material = halo.current.material as THREE.MeshBasicMaterial;
    const pulse = 0.35 + Math.sin(clock.elapsedTime * 3.2) * 0.22;
    material.opacity = selectable ? 0.4 + pulse * 0.6 : active ? pulse : selected ? 0.45 : 0;
    material.color.set(selectable ? '#5cf2a5' : active ? '#ffd166' : '#4fd6ff');
  });

  const width = transform.width - 0.03;
  const depth = transform.depth - 0.03;
  const ownable = tile.kind === 'city' || tile.kind === 'resort';

  return (
    <group position={[transform.x, 0, transform.z]} rotation={[0, transform.rotationY, 0]}>
      <mesh
        castShadow
        receiveShadow
        position={[0, 0.12, 0]}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(index);
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto';
        }}
      >
        <boxGeometry args={[width, 0.24, depth]} />
        <meshStandardMaterial attach="material-0" color={EDGE_COLOR} roughness={0.85} />
        <meshStandardMaterial attach="material-1" color={EDGE_COLOR} roughness={0.85} />
        <meshStandardMaterial attach="material-2" map={texture} roughness={0.68} metalness={0.02} />
        <meshStandardMaterial attach="material-3" color={BODY_COLOR} roughness={0.9} />
        <meshStandardMaterial attach="material-4" color={EDGE_COLOR} roughness={0.85} />
        <meshStandardMaterial attach="material-5" color={EDGE_COLOR} roughness={0.85} />
      </mesh>

      {/* Ownership bar along the outer lip, plus a small glowing marker. */}
      {ownable && ownerColor && (
        <group>
          <mesh position={[0, 0.25, depth / 2 - 0.13]}>
            <boxGeometry args={[width * 0.9, 0.06, 0.2]} />
            <meshStandardMaterial
              color={ownerColor}
              emissive={ownerColor}
              emissiveIntensity={0.85}
              roughness={0.35}
            />
          </mesh>
          <mesh position={[width / 2 - 0.16, 0.36, depth / 2 - 0.16]}>
            <cylinderGeometry args={[0.055, 0.055, 0.24, 10]} />
            <meshStandardMaterial
              color={ownerColor}
              emissive={ownerColor}
              emissiveIntensity={1.4}
              roughness={0.25}
            />
          </mesh>
        </group>
      )}

      {/* Turn / selection halo. */}
      <mesh ref={halo} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width + 0.34, depth + 0.34]} />
        <meshBasicMaterial
          color="#4fd6ff"
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
