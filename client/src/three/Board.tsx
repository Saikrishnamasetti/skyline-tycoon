import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BOARD, COLOR_HEX } from '@shared';
import type { GameState } from '@shared';
import { tileCenter } from '../lib/layout';
import { championshipBadge } from '../lib/textures';
import { TableBase } from './TableBase';
import { TileMesh } from './TileMesh';
import { Token } from './Token';
import { Buildings } from './Buildings';
import { Dice } from './Dice';
import type { DiceAnim, TokenTarget } from '../store/useGame';

interface BoardProps {
  state: GameState;
  tokens: Record<string, TokenTarget>;
  dice: DiceAnim | null;
  selectedTile: number | null;
  /** Tiles the player may pick right now, highlighted on the board. */
  selectable: number[];
  onSelectTile: (index: number) => void;
}

/** A gold multiplier badge bobbing over the city hosting the championship. */
function ChampionshipMarker({ tile, multiplier }: { tile: number; multiplier: number }) {
  const ref = useRef<THREE.Sprite>(null);
  const texture = useMemo(() => championshipBadge(multiplier), [multiplier]);
  const [x, , z] = tileCenter(tile, 0);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.y = 2.2 + Math.sin(clock.elapsedTime * 2) * 0.15;
  });

  return (
    <group>
      <sprite ref={ref} position={[x, 2.2, z]} scale={[1.3, 1.3, 1.3]}>
        <spriteMaterial map={texture} transparent depthWrite={false} />
      </sprite>
      <pointLight position={[x, 1.6, z]} color="#ffd166" intensity={6} distance={4} />
    </group>
  );
}

export function Board({ state, tokens, dice, selectedTile, selectable, onSelectTile }: BoardProps) {
  const currentPlayerId = state.order[state.currentIndex] ?? null;
  const currentPlayer = state.players.find((p) => p.id === currentPlayerId) ?? null;

  const ownerColors = useMemo(() => {
    const map: Record<number, string | undefined> = {};
    for (const tile of BOARD) {
      const holding = state.holdings[tile.index];
      if (!holding?.owner) continue;
      const owner = state.players.find((p) => p.id === holding.owner);
      map[tile.index] = owner ? COLOR_HEX[owner.color] : undefined;
    }
    return map;
  }, [state.holdings, state.players]);

  const diceVisible =
    state.status === 'playing' &&
    state.dice !== null &&
    state.phase !== 'game_over';

  return (
    <group>
      <TableBase />

      {BOARD.map((tile) => (
        <TileMesh
          key={tile.index}
          index={tile.index}
          ownerColor={ownerColors[tile.index]}
          active={!!currentPlayer && currentPlayer.position === tile.index}
          selected={selectedTile === tile.index}
          selectable={selectable.includes(tile.index)}
          onSelect={onSelectTile}
        />
      ))}

      <Buildings state={state} />

      {state.championship.tile !== null && (
        <ChampionshipMarker
          tile={state.championship.tile}
          multiplier={1 + state.championship.level}
        />
      )}

      {state.players.map((player) => {
        const target = tokens[player.id] ?? {
          index: player.position,
          walk: false,
          steps: 0,
          seq: 0,
        };
        return (
          <Token
            key={player.id}
            player={player}
            target={target}
            isCurrent={player.id === currentPlayerId}
          />
        );
      })}

      <Dice
        values={state.dice}
        rollId={dice?.rollId ?? state.rollId}
        visible={diceVisible}
      />
    </group>
  );
}
