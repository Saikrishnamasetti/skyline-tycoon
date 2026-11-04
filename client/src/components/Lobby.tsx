import { useState } from 'react';
import { PLAYER_COLORS, TOKEN_SHAPES } from '@shared';
import type { GameSettings, GameState, Identity, Player } from '@shared';
import { cx, copyText } from '../lib/format';
import { api } from '../net/socket';
import { LOCAL_MODE } from '../net/mode';
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
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
      <Avatar player={player} size={38} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-display text-sm font-semibold text-slate-900">
            {player.name}
          </span>
          {player.id === state.hostId && (
            <span className="chip border-amber-400/30 px-1.5 py-0 text-[9px] text-amber-700">
              Host
            </span>
          )}
          {player.id === meId && <span className="chip px-1.5 py-0 text-[9px]">You</span>}
        </div>
        <span className="text-[11px] text-slate-500">
          {PLAYER_COLORS.find((c) => c.id === player.color)?.label} &middot;{' '}
          {TOKEN_SHAPES.find((t) => t.id === player.token)?.label}
        </span>
      </div>
      {player.isBot && isHost && (
        <button
          type="button"
          className="rounded-lg px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-100 hover:text-rose-700"
          onClick={() => void api.removeBot(player.id)}
          aria-label={`Remove ${player.name}`}
        >
          Remove
        </button>
      )}
      {!player.connected ? (
        <span className="chip border-amber-400/30 text-amber-700">Away</span>
      ) : player.ready || player.id === state.hostId ? (
        <span className="chip border-emerald-400/30 text-emerald-700">Ready</span>
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
        <div className="rounded-2xl border border-neon-cyan/25 bg-neon-cyan/8 px-5 py-3">
          <span className="select-all font-mono text-3xl font-bold tracking-[0.32em] text-neon-cyan">
            {state.roomCode}
          </span>
        </div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className="btn-ghost px-3 py-1.5 text-[12px]"
            onClick={() => void copy('code')}
          >
            {copied === 'code' ? 'Copied' : 'Copy room code'}
          </button>
          <button
            type="button"
            className="btn-ghost px-3 py-1.5 text-[12px]"
            onClick={() => void share()}
          >
            {copied === 'link' ? 'Link copied' : 'Invite friends'}
          </button>
        </div>
      </div>
      <p className="mt-2 break-all text-[11px] text-slate-500">{inviteUrl}</p>
    </div>
  );
}

export function Lobby({ state, me, onLeave }: LobbyProps) {
  const [rules, setRules] = useState(false);
  const isHost = !!me && me.id === state.hostId;

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
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Room lobby</h1>
          <p className="text-[12.5px] text-slate-500">
            {state.players.length} of {state.settings.maxPlayers} seats filled
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ConnectionBadge />
          <button
            type="button"
            className="btn-ghost px-3 py-1.5 text-[12px]"
            onClick={() => setRules(true)}
          >
            Rules
          </button>
          <button type="button" className="btn-ghost px-3 py-1.5 text-[12px]" onClick={onLeave}>
            Leave
          </button>
        </div>
      </header>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <div className="space-y-4">
          {LOCAL_MODE ? (
            <div className="panel p-4">
              <span className="label">Playing on this device</span>
              <p className="mt-2 text-[12.5px] leading-relaxed text-slate-600">
                This edition runs in your browser, so your rivals are bots. Add one to three of
                them below, then start the game. A refresh mid-game picks up where you left off.
              </p>
            </div>
          ) : (
            <ShareCard state={state} />
          )}
          <div className="panel p-4">
            <span className="label">At the table</span>
            <div className="mt-2 space-y-2">
              {state.players.map((player) => (
                <SeatRow key={player.id} player={player} state={state} meId={me?.id} />
              ))}
              {Array.from({ length: emptySeats }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="flex items-center gap-3 rounded-xl border border-dashed border-slate-200 px-3 py-3 text-[12px] text-slate-400"
                >
                  <span className="h-9 w-9 rounded-xl border border-dashed border-slate-200" />
                  <span className="flex-1">
                    {LOCAL_MODE ? 'Empty seat' : 'Waiting for another tycoon'}
                  </span>
                  {isHost && i === 0 && (
                    <button type="button" className="btn-ghost px-3 py-1.5 text-[12px]" onClick={() => void api.addBot()}>
                      Add a bot
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="panel p-4">
            <span className="label">Your look</span>
            <div className="mt-2">
              <IdentityPicker
                value={identity}
                takenColors={takenColors}
                takenTokens={takenTokens}
                onChange={(next) => void api.setIdentity(next)}
              />
            </div>
          </div>

          <div className="panel p-4">
            <div className="flex items-center justify-between">
              <span className="label">Table setup</span>
              {!isHost && <span className="text-[11px] text-slate-500">Host controls these</span>}
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

      <div className="sticky bottom-3 mt-5">
        <div className="panel flex flex-wrap items-center gap-3 px-4 py-3">
          {isHost ? (
            <>
              <span className="flex-1 text-[12.5px] text-slate-500">
                {state.players.length < 2
                  ? LOCAL_MODE
                    ? 'Add at least one bot to start.'
                    : 'You need at least one more player.'
                  : everyoneReady
                    ? 'Everyone is ready when you are.'
                    : 'Waiting for the others to mark themselves ready.'}
              </span>
              <button
                type="button"
                className={cx('btn-primary px-6', canStart && 'animate-pulse-ring')}
                disabled={!canStart}
                onClick={() => void api.startGame()}
              >
                Start game
              </button>
            </>
          ) : (
            <>
              <span className="flex-1 text-[12.5px] text-slate-500">
                Mark yourself ready and the host can start.
              </span>
              <button
                type="button"
                className={me?.ready ? 'btn-ghost px-6' : 'btn-primary px-6'}
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
