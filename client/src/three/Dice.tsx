import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { DIE_FACE_VALUES, DIE_REST_ROTATION, dieFaceTexture } from '../lib/textures';

interface DiceProps {
  values: [number, number] | null;
  rollId: number;
  /** Hidden between turns so the centre of the board stays clear. */
  visible: boolean;
}

const TUMBLE_MS = 950;
const SETTLE_MS = 420;

function Die({
  value,
  offsetX,
  rollId,
  spin,
}: {
  value: number;
  offsetX: number;
  rollId: number;
  spin: [number, number, number];
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const started = useRef(performance.now());
  const materials = useMemo(
    () =>
      DIE_FACE_VALUES.map(
        (face) =>
          new THREE.MeshStandardMaterial({
            map: dieFaceTexture(face),
            roughness: 0.34,
            metalness: 0.06,
          }),
      ),
    [],
  );

  useEffect(() => {
    started.current = performance.now();
  }, [rollId]);

  useFrame(() => {
    if (!mesh.current) return;
    const elapsed = performance.now() - started.current;
    const rest = DIE_REST_ROTATION[value] ?? [0, 0, 0];

    if (elapsed < TUMBLE_MS) {
      const t = elapsed / 1000;
      mesh.current.rotation.set(t * spin[0], t * spin[1], t * spin[2]);
      const hop = Math.abs(Math.sin(elapsed / 110)) * (1 - elapsed / TUMBLE_MS);
      mesh.current.position.set(offsetX, 1.25 + hop * 1.7, 0);
    } else {
      const k = Math.min(1, (elapsed - TUMBLE_MS) / SETTLE_MS);
      // Ease out so the die visibly locks onto the server's number.
      const ease = 1 - (1 - k) ** 3;
      mesh.current.rotation.x = THREE.MathUtils.lerp(mesh.current.rotation.x, rest[0], ease);
      mesh.current.rotation.y = THREE.MathUtils.lerp(mesh.current.rotation.y, rest[1], ease);
      mesh.current.rotation.z = THREE.MathUtils.lerp(mesh.current.rotation.z, rest[2], ease);
      if (k >= 1) mesh.current.rotation.set(rest[0], rest[1], rest[2]);
      mesh.current.position.set(offsetX, 1.25 + (1 - ease) * 0.35, 0);
    }
  });

  return (
    <mesh ref={mesh} castShadow material={materials}>
      <boxGeometry args={[0.92, 0.92, 0.92]} />
    </mesh>
  );
}

export function Dice({ values, rollId, visible }: DiceProps) {
  const spins = useMemo<[[number, number, number], [number, number, number]]>(
    () => [
      [9 + Math.random() * 7, 11 + Math.random() * 6, 7 + Math.random() * 5],
      [8 + Math.random() * 7, 12 + Math.random() * 6, 9 + Math.random() * 5],
    ],
    [rollId],
  );

  if (!values || !visible) return null;
  return (
    // Parked below the wordmark so the centre art stays readable.
    <group position={[0, 0, 3.6]}>
      <Die value={values[0]} offsetX={-0.78} rollId={rollId} spin={spins[0]} />
      <Die value={values[1]} offsetX={0.78} rollId={rollId} spin={spins[1]} />
      <pointLight position={[0, 2.6, 0]} intensity={14} distance={9} color="#ffe9b0" />
    </group>
  );
}
