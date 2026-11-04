import { useState } from 'react';
import type { ReactNode } from 'react';
import { playerHoldings, tileAt } from '@shared';
import type { GameState, Player } from '@shared';
import { Scene } from '../three/Scene';
import { LogPanel } from '../ui/LogPanel';
import { ActionBar } from '../ui/ActionBar';
import { PortfolioPanel } from '../ui/PortfolioPanel';
import { TradePanel, TradeInbox } from '../ui/TradePanel';
import { PropertyCard } from '../ui/PropertyCard';
import { CardOverlay } from '../ui/CardOverlay';
import { GameOver } from '../ui/GameOver';
import { MatchClock } from '../ui/MatchClock';
import { PlayerBadge } from '../ui/PlayerBadge';
import type { Corner } from '../ui/PlayerBadge';
import { travelDestinations } from '../ui/DecisionPanels';
import { CitiesIcon, LeaveIcon, LogIcon, RecentreIcon, RulesIcon, SoundIcon } from '../ui/Icons';
import { Modal } from '../ui/atoms';
import { HowToPlay } from './HowToPlay';
import { useGame } from '../store/useGame';
import { useActions } from '../hooks/useActions';
import { setSoundEnabled } from '../lib/audio';
import { cx } from '../lib/format';

interface GameTableProps {
  state: GameState;
  me: Player | null;
  onLeave: () => void;
}

/** Turn order decides the corner: first seat top-left, then clockwise. */
const CORNERS: Corner[] = ['tl', 'tr', 'br', 'bl'];
const CORNER_CLASS: Record<Corner, string> = {
  tl: 'left-4 top-4',
  tr: 'right-4 top-4',
  br: 'bottom-4 right-4',
  bl: 'bottom-4 left-4',
};

function SideButton({
  children,
  label,
  onClick,
  active = false,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cx('icon-btn group relative', active && 'text-sky-600 ring-2 ring-sky-300')}
    >
      {children}
      {/* The name slides out on hover or keyboard focus. */}
      <span
        aria-hidden
        className="pointer-events-none absolute right-full mr-2.5 translate-x-2 whitespace-nowrap rounded-xl bg-slate-900/90 px-3 py-1.5 font-display text-sm font-semibold text-white opacity-0 shadow-lg transition duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"
      >
        {label}
      </span>
    </button>
  );
}

export function GameTable({ state, me, onLeave }: GameTableProps) {
  const tokens = useGame((s) => s.tokens);
  const dice = useGame((s) => s.dice);
  const selectedTile = useGame((s) => s.selectedTile);
  const selectTile = useGame((s) => s.selectTile);
  const sound = useGame((s) => s.sound);
  const setSound = useGame((s) => s.setSound);
  const act = useActions();

  const [portfolio, setPortfolio] = useState(false);
  const [trade, setTrade] = useState(false);
  const [rules, setRules] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [cameraReset, setCameraReset] = useState(0);
  const [contextLost, setContextLost] = useState(false);

  // Spaces the player can pick straight off the board right now.
  const selectable = (() => {
    if (!me || state.status !== 'playing') return [];
    if (state.championshipOffer?.playerId === me.id) {
      return playerHoldings(state, me.id).filter((i) => tileAt(i).kind === 'city');
    }
    const myTurn = state.order[state.currentIndex] === me.id;
    if (myTurn && state.phase === 'pre_roll' && me.cash >= state.settings.worldTourFee) {
      return travelDestinations(state, me);
    }
    return [];
  })();

  const handleTile = (index: number | null) => {
    if (index === null || !selectable.includes(index)) {
      selectTile(index);
      return;
    }
    if (state.championshipOffer?.playerId === me?.id) void act({ type: 'hostChampionship', tile: index });
    else void act({ type: 'travel', tile: index });
  };

  const seated = state.order
    .map((id) => state.players.find((p) => p.id === id))
    .filter((p): p is Player => !!p);
  const current = state.players.find((p) => p.id === state.order[state.currentIndex]);
  const toggleSound = () => {
    setSound(!sound);
    setSoundEnabled(!sound);
  };

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="absolute inset-0">
        <Scene
          state={state}
          tokens={tokens}
          dice={dice}
          selectedTile={selectedTile}
          selectable={selectable}
          onSelectTile={handleTile}
          resetSignal={cameraReset}
          onContextChange={setContextLost}
        />
      </div>

      {contextLost && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-6 backdrop-blur-sm">
          <div className="panel max-w-sm p-5 text-center">
            <h2 className="font-display text-xl font-semibold text-slate-900">The 3D board needs a reload</h2>
            <p className="mt-2 text-base leading-relaxed text-slate-600">
              Your browser released the graphics card, usually after a long spell in the background. Your seat is
              safe - reloading picks the game up exactly where it is.
            </p>
            <button type="button" className="btn-primary mt-4" onClick={() => window.location.reload()}>
              Reload the board
            </button>
          </div>
        </div>
      )}

      {/* Players in the corners, like seats round a real table. */}
      <div className="pointer-events-none absolute inset-0 hidden sm:block">
        {seated.map((player, seat) => (
          <div key={player.id} className={cx('absolute', CORNER_CLASS[CORNERS[seat % 4]])}>
            <div className="hidden xl:block">
              <PlayerBadge
                state={state}
                player={player}
                corner={CORNERS[seat % 4]}
                isMe={player.id === me?.id}
                onClick={() => player.id === me?.id && setPortfolio(true)}
              />
            </div>
            <div className="xl:hidden">
              <PlayerBadge
                state={state}
                player={player}
                corner={CORNERS[seat % 4]}
                isMe={player.id === me?.id}
                compact
                onClick={() => player.id === me?.id && setPortfolio(true)}
              />
            </div>
          </div>
        ))}
      </div>
      {/* Phones: one compact row under the timer instead. */}
      <div className="pointer-events-none absolute inset-x-0 top-[4.25rem] flex flex-wrap justify-center gap-2 px-3 sm:hidden">
        {seated.map((player) => (
          <PlayerBadge key={player.id} state={state} player={player} corner="tl" isMe={player.id === me?.id} mini />
        ))}
      </div>

      {/* Timer pill, top centre. */}
      <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center sm:top-4">
        <div className="pointer-events-auto flex items-center gap-2.5 rounded-full border-2 border-white bg-white/95 px-4 py-1.5 shadow-glass">
          <span className="font-display text-sm font-semibold tracking-[0.16em] text-sky-600">{state.roomCode}</span>
          <MatchClock state={state} />
          {current && state.status === 'playing' && (
            <span className="hidden font-display text-base font-semibold text-slate-700 md:inline">
              {current.id === me?.id ? 'Your turn' : `${current.name}'s turn`}
            </span>
          )}
        </div>
      </div>

      {/* Round buttons down the right-hand side. */}
      <div className="absolute right-3 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-2 sm:right-4">
        <SideButton label={sound ? 'Mute sound' : 'Unmute sound'} onClick={toggleSound}>
          <SoundIcon muted={!sound} />
        </SideButton>
        <SideButton label="Recentre camera" onClick={() => setCameraReset((n) => n + 1)}>
          <RecentreIcon />
        </SideButton>
        <SideButton label="My cities" onClick={() => setPortfolio(true)}>
          <CitiesIcon />
        </SideButton>
        <SideButton label="Activity log" onClick={() => setLogOpen((v) => !v)} active={logOpen}>
          <LogIcon />
        </SideButton>
        <SideButton label="How to play" onClick={() => setRules(true)}>
          <RulesIcon />
        </SideButton>
        <SideButton label="Leave the game" onClick={onLeave}>
          <LeaveIcon />
        </SideButton>
      </div>

      {logOpen && (
        <div className="absolute right-[4.25rem] top-1/2 z-10 w-[min(22rem,calc(100vw-5.5rem))] -translate-y-1/2 sm:right-[5.25rem]">
          <LogPanel state={state} className="max-h-[52vh]" />
        </div>
      )}

      {/* The action panel, bottom centre between the lower seats. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-3 pb-3 safe-bottom sm:px-44 sm:pb-4 lg:px-56 xl:px-72">
        <div className="pointer-events-auto w-full max-w-3xl space-y-2">
          <TradeInbox state={state} me={me} />
          <ActionBar state={state} me={me} onOpenPortfolio={() => setPortfolio(true)} onOpenTrade={() => setTrade(true)} />
        </div>
      </div>

      <CardOverlay state={state} />

      <Modal open={selectedTile !== null} onClose={() => selectTile(null)} title="Space details">
        {selectedTile !== null && <PropertyCard state={state} index={selectedTile} />}
      </Modal>

      <PortfolioPanel open={portfolio} onClose={() => setPortfolio(false)} state={state} me={me} />
      <TradePanel open={trade} onClose={() => setTrade(false)} state={state} me={me} />
      <HowToPlay open={rules} onClose={() => setRules(false)} />
      <GameOver state={state} me={me} onLeave={onLeave} />
    </div>
  );
}
