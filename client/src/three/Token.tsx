import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BOARD_SIZE, COLOR_HEX } from '@shared';
import type { Player } from '@shared';
import { TILE_TOP_Y, tokenSlot, walkPoint } from '../lib/layout';
import type { TokenTarget } from '../store/useGame';

interface TokenProps {
  player: Player;
  target: TokenTarget;
  isCurrent: boolean;
  onStep?: () => void;
}

/** Tiles travelled per second while a piece walks the board. */
const WALK_SPEED = 7.5;

function TokenBody({ shape, color }: { shape: Player['token']; color: string }) {
  const material = (
    <meshStandardMaterial
      color={color}
      emissive={color}
      emissiveIntensity={0.12}
      roughness={0.4}
      metalness={0.15}
    />
  );
  switch (shape) {
    case 'spire':
      return (
        <group>
          <mesh castShadow position={[0, 0.06, 0]}>
            <cylinderGeometry args={[0.24, 0.28, 0.12, 20]} />
            {material}
          </mesh>
          <mesh castShadow position={[0, 0.46, 0]}>
            <coneGeometry args={[0.2, 0.68, 18]} />
            {material}
          </mesh>
        </group>
      );
    case 'dome':
      return (
        <group>
          <mesh castShadow position={[0, 0.07, 0]}>
            <cylinderGeometry args={[0.26, 0.29, 0.14, 20]} />
            {material}
          </mesh>
          <mesh castShadow position={[0, 0.34, 0]}>
            <sphereGeometry args={[0.25, 22, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
            {material}
          </mesh>
          <mesh castShadow position={[0, 0.58, 0]}>
            <sphereGeometry args={[0.08, 12, 10]} />
            {material}
          </mesh>
        </group>
      );
    case 'prism':
      return (
        <group>
          <mesh castShadow position={[0, 0.06, 0]}>
            <cylinderGeometry args={[0.25, 0.28, 0.12, 6]} />
            {material}
          </mesh>
          <mesh castShadow position={[0, 0.42, 0]} rotation={[0, Math.PI / 6, 0]}>
            <octahedronGeometry args={[0.3, 0]} />
            {material}
          </mesh>
        </group>
      );
    default:
      return (
        <group>
          <mesh castShadow position={[0, 0.06, 0]}>
            <cylinderGeometry args={[0.26, 0.3, 0.12, 20]} />
            {material}
          </mesh>
          <mesh castShadow position={[0, 0.34, 0]}>
            <boxGeometry args={[0.3, 0.46, 0.3]} />
            {material}
          </mesh>
          <mesh castShadow position={[0, 0.64, 0]}>
            <boxGeometry args={[0.2, 0.2, 0.2]} />
            {material}
          </mesh>
        </group>
      );
  }
}

export function Token({ player, target, isCurrent, onStep }: TokenProps) {
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const color = COLOR_HEX[player.color];

  /** Animation cursor: which tile we are on and how far to the next one. */
  const walk = useRef({
    index: target.index,
    remaining: 0,
    dir: 1,
    t: 0,
    seq: target.seq,
  });

  useEffect(() => {
    const anim = walk.current;
    if (anim.seq === target.seq) return;
    anim.seq = target.seq;
    if (!target.walk) {
      anim.index = target.index;
      anim.remaining = 0;
      anim.t = 0;
      return;
    }
    const dir = target.steps < 0 ? -1 : 1;
    // Always finish exactly on the server's tile, whatever we were mid-way through.
    const distance =
      dir === 1
        ? (target.index - anim.index + BOARD_SIZE) % BOARD_SIZE
        : (anim.index - target.index + BOARD_SIZE) % BOARD_SIZE;
    anim.dir = dir;
    anim.remaining = distance === 0 ? 0 : distance;
    anim.t = 0;
    if (anim.remaining === 0) anim.index = target.index;
  }, [target.seq, target.index, target.walk, target.steps]);

  const seat = player.seat;

  useFrame((state, delta) => {
    const anim = walk.current;
    if (!group.current) return;

    if (anim.remaining > 0) {
      anim.t += delta * WALK_SPEED;
      while (anim.t >= 1 && anim.remaining > 0) {
        anim.t -= 1;
        anim.index = (anim.index + anim.dir + BOARD_SIZE) % BOARD_SIZE;
        anim.remaining -= 1;
        onStep?.();
      }
      if (anim.remaining === 0) anim.t = 0;
    }

    if (anim.remaining > 0) {
      const next = (anim.index + anim.dir + BOARD_SIZE) % BOARD_SIZE;
      const [x, y, z] = walkPoint(anim.index, next, anim.t, seat);
      group.current.position.set(x, y, z);
      group.current.rotation.y += delta * 3.2;
    } else {
      const [x, , z] = tokenSlot(anim.index, seat);
      const bob = isCurrent ? Math.sin(state.clock.elapsedTime * 2.4) * 0.05 : 0;
      group.current.position.set(x, TILE_TOP_Y + bob, z);
      group.current.rotation.y = THREE.MathUtils.lerp(
        group.current.rotation.y,
        0,
        Math.min(1, delta * 6),
      );
    }

    if (ring.current) {
      const material = ring.current.material as THREE.MeshBasicMaterial;
      material.opacity = isCurrent ? 0.55 + Math.sin(state.clock.elapsedTime * 4) * 0.25 : 0;
      const scale = isCurrent ? 1 + Math.sin(state.clock.elapsedTime * 4) * 0.08 : 1;
      ring.current.scale.setScalar(scale);
    }
  });

  if (player.bankrupt) return null;

  return (
    <group ref={group}>
      <group scale={player.connected ? 1 : 0.86}>
        <TokenBody shape={player.token} color={color} />
      </group>
      <mesh ref={ring} position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.34, 0.46, 28]} />
        <meshBasicMaterial color={color} transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}
