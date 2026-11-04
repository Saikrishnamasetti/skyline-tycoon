import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_SETTINGS, formatCompact } from '@shared';
import type { GameSettings, Identity } from '@shared';
import { PreviewScene } from '../three/PreviewScene';
import { IdentityPicker } from '../components/IdentityPicker';
import { ConnectionBadge } from '../components/ConnectionBadge';
import { RoomSettingsForm } from '../components/RoomSettingsForm';
import { HowToPlay } from '../components/HowToPlay';
import { Modal } from '../ui/atoms';
import { api, loadProfile, rememberSeat, saveProfile } from '../net/socket';
import { LOCAL_MODE } from '../net/mode';
import { primeAudio } from '../lib/audio';
import { useGame } from '../store/useGame';

type Dialog = 'none' | 'create' | 'join' | 'rules';

export function Landing() {
  const navigate = useNavigate();
  const applyState = useGame((s) => s.applyState);
  const setSeat = useGame((s) => s.setSeat);
  const setProfile = useGame((s) => s.setProfile);
  const pushToast = useGame((s) => s.pushToast);

  const [dialog, setDialog] = useState<Dialog>('none');
  const [identity, setIdentity] = useState<Identity>(() => loadProfile());
  const [settings, setSettings] = useState<GameSettings>({ ...DEFAULT_SETTINGS });
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Leaving a table should not keep its state around behind the scenes.
    useGame.getState().clearRoom();
  }, []);

  const enter = async (kind: 'create' | 'join') => {
    primeAudio();
    setBusy(true);
    const profile: Identity = { ...identity, name: identity.name.trim() || 'Tycoon' };
    saveProfile(profile);
    setProfile(profile);

    const res =
      kind === 'create'
        ? await api.createRoom(profile, settings)
        : await api.joinRoom(code.trim().toUpperCase(), profile);
    setBusy(false);

    if (!res.ok || !res.data) {
      pushToast({ title: 'Could not get you in', detail: res.error, tone: 'bad' });
      return;
    }
    rememberSeat(res.data.roomCode, {
      playerId: res.data.playerId,
      sessionToken: res.data.sessionToken,
    });
    setSeat(res.data.roomCode, res.data.playerId);
    applyState(res.data.state);
    navigate(`/room/${res.data.roomCode}`);
  };

  return (
    <div className="relative min-h-full overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <PreviewScene />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/80 via-white/35 to-transparent" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-6 sm:px-8">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-neon-cyan to-neon-violet font-display text-sm font-bold text-white">
              ST
            </div>
            <span className="font-display text-lg font-bold tracking-tight text-slate-900">
              Skyline Tycoon
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ConnectionBadge />
            <button
              type="button"
              className="btn-ghost px-3 py-1.5 text-[12px]"
              onClick={() => setDialog('rules')}
            >
              How to play
            </button>
          </div>
        </header>

        <main className="flex flex-1 flex-col justify-center py-10">
          <div className="max-w-2xl">
            <span className="chip border-neon-cyan/30 text-neon-cyan">
              {LOCAL_MODE
                ? '3D board game: you against up to three bots'
                : 'Real-time 3D board game for 2 to 4 players'}
            </span>
            <h1 className="mt-4 font-display text-4xl font-bold leading-[1.08] tracking-tight text-slate-900 sm:text-6xl">
              Build the skyline.
              <br />
              <span className="bg-gradient-to-r from-neon-cyan via-neon-violet to-neon-gold bg-clip-text text-transparent">
                Outlast your friends.
              </span>
            </h1>
            <p className="mt-4 max-w-xl text-balance text-[15px] leading-relaxed text-slate-700 sm:text-base">
              Claim cities around the world, build them up, buy your rivals out and race for a side,
              triple or resort monopoly.{' '}
              {LOCAL_MODE
                ? 'This edition runs entirely in your browser: pick your bots and play.'
                : 'Private rooms, bots to fill empty seats, and a server that referees every roll.'}
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <button
                type="button"
                className="btn-primary px-6 py-3 text-base"
                disabled={busy}
                onClick={() => {
                  setSettings({ ...DEFAULT_SETTINGS });
                  setDialog('create');
                }}
              >
                Play now
              </button>
              {!LOCAL_MODE && (
                <button
                  type="button"
                  className="btn-ghost px-6 py-3 text-base"
                  onClick={() => setDialog('join')}
                >
                  Join with a code
                </button>
              )}
            </div>

            <dl className="mt-10 grid max-w-xl grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
              {[
                ['32', 'spaces'],
                ['8', 'countries'],
                ['4', 'resorts'],
                [formatCompact(DEFAULT_SETTINGS.startingCash), 'to start'],
              ].map(([value, label]) => (
                <div key={label}>
                  <dt className="font-display text-xl font-bold text-slate-900">{value}</dt>
                  <dd className="text-[11px] uppercase tracking-wider text-slate-500">{label}</dd>
                </div>
              ))}
            </dl>
          </div>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4 text-[11px] text-slate-500">
          <span>An original property trading game. Every graphic is drawn in your browser.</span>
          <span>
            {LOCAL_MODE
              ? 'No server needed: the referee runs in this tab.'
              : 'Server-authoritative dice, money and deeds.'}
          </span>
        </footer>
      </div>

      <Modal
        open={dialog === 'create'}
        onClose={() => setDialog('none')}
        title={LOCAL_MODE ? 'Set up your game' : 'Create a private room'}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setDialog('none')}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={() => void enter('create')}
            >
              {busy ? 'Creating...' : LOCAL_MODE ? 'Continue' : 'Create room'}
            </button>
          </div>
        }
      >
        <div className="space-y-5">
          <IdentityPicker value={identity} onChange={setIdentity} />
          <RoomSettingsForm value={settings} onChange={setSettings} />
        </div>
      </Modal>

      <Modal
        open={dialog === 'join'}
        onClose={() => setDialog('none')}
        title="Join a room"
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setDialog('none')}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={busy || code.trim().length !== 6}
              onClick={() => void enter('join')}
            >
              {busy ? 'Joining...' : 'Join room'}
            </button>
          </div>
        }
      >
        <div className="space-y-5">
          <div>
            <label className="label" htmlFor="room-code">
              Room code
            </label>
            <input
              id="room-code"
              className="field mt-1.5 text-center font-mono text-2xl tracking-[0.4em]"
              maxLength={6}
              autoComplete="off"
              spellCheck={false}
              value={code}
              placeholder="ABC123"
              onChange={(event) =>
                setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
              }
            />
          </div>
          <IdentityPicker value={identity} onChange={setIdentity} />
        </div>
      </Modal>

      <HowToPlay open={dialog === 'rules'} onClose={() => setDialog('none')} />
    </div>
  );
}
