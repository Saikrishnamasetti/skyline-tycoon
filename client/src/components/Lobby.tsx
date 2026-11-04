import { useState } from 'react';
import { PLAYER_COLORS, TOKEN_SHAPES } from '@shared';
import type { GameSettings, GameState, Identity, Player } from '@shared';
import { cx, copyText } from '../lib/format';
import { api } from '../net/socket';
import { useNetMode } from '../net/mode';
import { useGame } from '../store/useGame';
import { Avatar } from '../ui/atoms';
import { IdentityPicker } from './IdentityPicker';
import { RoomSettingsForm } from './RoomSettingsForm';
import { HowToPlay } from './HowToPlay';
import { ConnectionBadge } from './ConnectionBadge';

interface LobbyProps {
  state: GameState;
  me: Player | null;
  onLeave: () => void;
}

function SeatRow({ player, state, meId }: { player: Player; state: GameState; meId?: string }) {
  const isHost = meId === state.hostId;
  return (
    <div className="flex items-center gap-3 rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3">
      <Avatar player={player} size={48} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-display text-lg font-semibold text-slate-900">
            {player.name}
          </span>
          {player.id === state.hostId && (
            <span className="chip border-amber-300 bg-amber-50 px-2 py-0 text-xs text-amber-800">
              Host
            </span>
          )}
          {player.id === meId && <span className="chip px-2 py-0 text-xs">You</span>}
        </div>
        <span className="text-sm text-slate-500">
          {PLAYER_COLORS.find((c) => c.id === player.color)?.label} &middot;{' '}
          {TOKEN_SHAPES.find((t) => t.id === player.token)?.label}
        </span>
      </div>
      {player.isBot && isHost && (
        <button
          type="button"
          className="min-h-[2.25rem] rounded-xl px-3 py-1 text-sm font-semibold text-slate-500 hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-300"
          onClick={() => void api.removeBot(player.id)}
          aria-label={`Remove ${player.name}`}
        >
          Remove
        </button>
      )}
      {!player.connected ? (
        <span className="chip border-amber-300 bg-amber-50 text-amber-800">Away</span>
      ) : player.ready || player.id === state.hostId ? (
        <span className="chip border-emerald-300 bg-emerald-50 text-emerald-800">Ready</span>
      ) : (
        <span className="chip">Not ready</span>
      )}
    </div>
  );
}

function ShareCard({ state }: { state: GameState }) {
  const pushToast = useGame((s) => s.pushToast);
  const [copied, setCopied] = useState<'none' | 'code' | 'link'>('none');
  const inviteUrl = `${window.location.origin}${import.meta.env.BASE_URL}room/${state.roomCode}`;

  const copy = async (what: 'code' | 'link') => {
    const ok = await copyText(what === 'code' ? state.roomCode : inviteUrl);
    if (ok) {
      setCopied(what);
      window.setTimeout(() => setCopied('none'), 1800);
    } else {
      pushToast({
        title: 'Copy failed',
        detail: 'Select the code and copy it manually',
        tone: 'bad',
      });
    }
  };

  const share = async () => {
    const nav = navigator as Navigator & {
      share?: (data: { title: string; text: string; url: string }) => Promise<void>;
    };
    if (nav.share) {
      try {
        await nav.share({
          title: 'Skyline Tycoon',
          text: `Join my game. Room code ${state.roomCode}`,
          url: inviteUrl,
        });
        return;
      } catch {
        /* the share sheet was dismissed; fall through to copying */
      }
    }
    void copy('link');
  };

  return (
    <div className="panel p-4">
      <span className="label">Share this code</span>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <div className="rounded-2xl border-2 border-sky-200 bg-sky-50 px-5 py-3">
          <span className="select-all font-mono text-4xl font-bold tracking-[0.32em] text-sky-600">
            {state.roomCode}
          </span>
        </div>
        <div className="flex flex-col gap-2">
          <button type="button" className="btn-ghost btn-sm" onClick={() => void copy('code')}>
            {copied === 'code' ? 'Copied' : 'Copy room code'}
          </button>
          <button type="button" className="btn-ghost btn-sm" onClick={() => void share()}>
            {copied === 'link' ? 'Link copied' : 'Invite friends'}
          </button>
        </div>
      </div>
      <p className="mt-3 break-all text-sm text-slate-500">{inviteUrl}</p>
    </div>
  );
}

export function Lobby({ state, me, onLeave }: LobbyProps) {
  const [rules, setRules] = useState(false);
  const isHost = !!me && me.id === state.hostId;
  const solo = useNetMode() === 'solo';

  const identity: Identity = {
    name: me?.name ?? '',
    color: me?.color ?? 'cobalt',
    token: me?.token ?? 'tower',
  };
  const takenColors = state.players.filter((p) => p.id !== me?.id).map((p) => p.color);
  const takenTokens = state.players.filter((p) => p.id !== me?.id).map((p) => p.token);

  const everyoneReady = state.players
    .filter((p) => p.id !== state.hostId)
    .every((p) => p.ready);
  const canStart = isHost && state.players.length >= 2 && everyoneReady;
  const emptySeats = Math.max(0, state.settings.maxPlayers - state.players.length);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-10 pt-6 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-slate-900 sm:text-4xl">Room lobby</h1>
          <p className="text-base text-slate-600">
            {state.players.length} of {state.settings.maxPlayers} seats filled
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ConnectionBadge />
          <button type="button" className="btn-ghost btn-sm" onClick={() => setRules(true)}>
            Rules
          </button>
          <button type="button" className="btn-ghost btn-sm" onClick={onLeave}>
            Leave
          </button>
        </div>
      </header>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        <div className="space-y-4">
          {solo ? (
            <div className="panel p-5">
              <span className="label">Solo game on this device</span>
              <p className="mt-2 text-base leading-relaxed text-slate-600">
                This game runs in your browser, so your rivals are bots. Add one to three of
                them below, then start the game. A refresh mid-game picks up where you left off.
              </p>
            </div>
          ) : (
            <ShareCard state={state} />
          )}
          <div className="panel p-5">
            <span className="label">At the table</span>
            <div className="mt-3 space-y-2.5">
              {state.players.map((player) => (
                <SeatRow key={player.id} player={player} state={state} meId={me?.id} />
              ))}
              {Array.from({ length: emptySeats }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 px-4 py-3 text-base text-slate-500"
                >
                  <span className="h-12 w-12 rounded-xl border-2 border-dashed border-slate-200" />
                  <span className="flex-1">
                    {solo ? 'Empty seat' : 'Waiting for another tycoon'}
                  </span>
                  {isHost && i === 0 && (
                    <button type="button" className="btn-ghost btn-sm" onClick={() => void api.addBot()}>
                      Add a bot
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="panel p-5">
            <span className="label">Your look</span>
            <div className="mt-3">
              <IdentityPicker
                value={identity}
                takenColors={takenColors}
                takenTokens={takenTokens}
                onChange={(next) => void api.setIdentity(next)}
              />
            </div>
          </div>

          <div className="panel p-5">
            <div className="flex items-center justify-between">
              <span className="label">Table setup</span>
              {!isHost && <span className="text-sm text-slate-500">Host controls these</span>}
            </div>
            <div className="mt-3">
              <RoomSettingsForm
                value={state.settings}
                disabled={!isHost}
                onChange={(next: GameSettings) => void api.setSettings(next)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Stays in reach while scrolling; a solid surface so nothing shows through. */}
      <div className="sticky bottom-3 z-10 mt-6">
        <div className="glass-strong flex flex-wrap items-center gap-3 rounded-3xl px-5 py-3.5 shadow-[0_4px_0_rgba(15,23,42,0.06),0_18px_40px_-12px_rgba(30,41,59,0.45)]">
          {isHost ? (
            <>
              <span className="flex-1 text-base text-slate-600">
                {state.players.length < 2
                  ? solo
                    ? 'Add at least one bot to start.'
                    : 'You need at least one more player.'
                  : everyoneReady
                    ? 'Everyone is ready when you are.'
                    : 'Waiting for the others to mark themselves ready.'}
              </span>
              <button
                type="button"
                className={cx('btn-primary px-8 text-lg', canStart && 'animate-pulse-ring')}
                disabled={!canStart}
                onClick={() => void api.startGame()}
              >
                Start game
              </button>
            </>
          ) : (
            <>
              <span className="flex-1 text-base text-slate-600">
                Mark yourself ready and the host can start.
              </span>
              <button
                type="button"
                className={me?.ready ? 'btn-ghost px-8 text-lg' : 'btn-primary px-8 text-lg'}
                onClick={() => void api.setReady(!me?.ready)}
              >
                {me?.ready ? 'Not ready' : 'I am ready'}
              </button>
            </>
          )}
        </div>
      </div>

      <HowToPlay open={rules} onClose={() => setRules(false)} />
    </div>
  );
}
