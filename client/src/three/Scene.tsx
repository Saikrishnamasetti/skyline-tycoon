import { Suspense, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { GameState } from '@shared';
import { Board } from './Board';
import type { DiceAnim, TokenTarget } from '../store/useGame';

interface SceneProps {
  state: GameState;
  tokens: Record<string, TokenTarget>;
  dice: DiceAnim | null;
  selectedTile: number | null;
  selectable: number[];
  onSelectTile: (index: number) => void;
  /** Bumping this recentres the camera on the default isometric view. */
  resetSignal: number;
  /** Fired when the browser drops or restores the WebGL context. */
  onContextChange?: (lost: boolean) => void;
}

/**
 * A browser can take the GPU context away at any time (tab backgrounded on a
 * phone, driver reset, too many live contexts). Three.js asks for it back,
 * but if it never returns the player is left with a black board, so the UI
 * needs to know and offer a reload.
 */
function ContextWatcher({ onChange }: { onChange?: (lost: boolean) => void }) {
  const { gl, invalidate } = useThree();

  useEffect(() => {
    if (!onChange) return;
    const canvas = gl.domElement;
    const lost = () => onChange(true);
    const restored = () => {
      onChange(false);
      invalidate();
    };
    canvas.addEventListener('webglcontextlost', lost);
    canvas.addEventListener('webglcontextrestored', restored);
    return () => {
      canvas.removeEventListener('webglcontextlost', lost);
      canvas.removeEventListener('webglcontextrestored', restored);
    };
  }, [gl, invalidate, onChange]);

  return null;
}

/**
 * Half-extents of the board as it actually projects from the default angle:
 * the full width across the screen, and a squashed depth because the camera
 * looks down at 45 degrees. Both include a margin for tokens and towers.
 */
const RADIUS_ACROSS = 13.4;
const RADIUS_DEEP = 11.2;

/**
 * Frames the whole board whatever the viewport shape. Phones get pushed back
 * far enough that no row is cut off, and the default angle stays isometric.
 */
function CameraRig({ resetSignal }: { resetSignal: number }) {
  const { camera, size, controls, scene } = useThree();

  useEffect(() => {
    const perspective = camera as THREE.PerspectiveCamera;
    const aspect = size.width / Math.max(1, size.height);
    const vFov = (perspective.fov * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    // Fit against whichever axis is tighter, so nothing spills off screen.
    const distance = THREE.MathUtils.clamp(
      Math.max(
        RADIUS_ACROSS / Math.tan(hFov / 2),
        RADIUS_DEEP / Math.tan(vFov / 2),
      ),
      18,
      140,
    );
    const leg = distance / Math.SQRT2;
    perspective.position.set(0, leg, leg);
    perspective.lookAt(0, 0, 0);
    perspective.updateProjectionMatrix();
    (controls as { target?: THREE.Vector3; update?: () => void } | null)?.target?.set(0, 0, 0);
    (controls as { update?: () => void } | null)?.update?.();

    // Fog is atmosphere, not a curtain: keep it behind wherever the camera
    // ended up, or a tall narrow viewport would fade the board away.
    const fog = scene.fog as THREE.Fog | null;
    if (fog) {
      fog.near = distance * 0.95;
      fog.far = distance * 2.8;
    }
  }, [resetSignal, camera, size.width, size.height, controls, scene]);

  return null;
}

function Lighting() {
  return (
    <>
      <ambientLight intensity={0.65} />
      <hemisphereLight args={['#ffffff', '#8fb27a', 0.9]} />
      <directionalLight
        castShadow
        position={[16, 30, 14]}
        intensity={2}
        color="#fff4e0"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={90}
        shadow-camera-left={-24}
        shadow-camera-right={24}
        shadow-camera-top={24}
        shadow-camera-bottom={-24}
        shadow-bias={-0.0006}
      />
      <directionalLight position={[-14, 12, -10]} intensity={0.45} color="#c7dcff" />
    </>
  );
}

export function Scene({
  state,
  tokens,
  dice,
  selectedTile,
  selectable,
  onSelectTile,
  resetSignal,
  onContextChange,
}: SceneProps) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [0, 27, 27], fov: 38, near: 0.5, far: 240 }}
      gl={{ antialias: true, powerPreference: 'high-performance', alpha: true }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1;
      }}
    >
      <fog attach="fog" args={['#d8eaff', 52, 120]} />
      <ContextWatcher onChange={onContextChange} />
      <CameraRig resetSignal={resetSignal} />
      <Lighting />
      <Suspense fallback={null}>
        <Board
          state={state}
          tokens={tokens}
          dice={dice}
          selectedTile={selectedTile}
          selectable={selectable}
          onSelectTile={onSelectTile}
        />
      </Suspense>
      <OrbitControls
        makeDefault
        enablePan
        enableDamping
        dampingFactor={0.08}
        minDistance={12}
        maxDistance={140}
        maxPolarAngle={Math.PI / 2.12}
        minPolarAngle={0.18}
        target={[0, 0, 0]}
        panSpeed={0.6}
        rotateSpeed={0.55}
      />
    </Canvas>
  );
}
