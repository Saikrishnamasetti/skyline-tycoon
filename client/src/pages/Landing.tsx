import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import type { Variants } from 'motion/react';
import { DEFAULT_SETTINGS, formatCompact } from '@shared';
import type { GameSettings, Identity } from '@shared';
import { PreviewScene } from '../three/PreviewScene';
import { IdentityPicker } from '../components/IdentityPicker';
import { ConnectionBadge } from '../components/ConnectionBadge';
import { RoomSettingsForm } from '../components/RoomSettingsForm';
import { HowToPlay } from '../components/HowToPlay';
import { Modal } from '../ui/atoms';
import { cx } from '../lib/format';
import { api, loadProfile, rememberSeat, saveProfile } from '../net/socket';
import { getNetMode, ONLINE_AVAILABLE, SOLO_AVAILABLE, setNetMode } from '../net/mode';
import { primeAudio } from '../lib/audio';
import { useGame } from '../store/useGame';

type Dialog = 'none' | 'create' | 'solo' | 'join' | 'rules';

/** Static builds that also reach a hosted server offer both kinds of game. */
const BOTH = ONLINE_AVAILABLE && SOLO_AVAILABLE;

/** The hero arrives line by line. */
const hero: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};
const rise: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 26 } },
};

export function Landing() {
  const navigate = useNavigate();
  const applyState = useGame((s) => s.applyState);
  const setSeat = useGame((s) => s.setSeat);
  const setProfile = useGame((s) => s.setProfile);
  const pushToast = useGame((s) => s.pushToast);
  const status = useGame((s) => s.status);

  const [dialog, setDialog] = useState<Dialog>('none');
  const [identity, setIdentity] = useState<Identity>(() => loadProfile());
  const [settings, setSettings] = useState<GameSettings>({ ...DEFAULT_SETTINGS });
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Leaving a table should not keep its state around behind the scenes.
    useGame.getState().clearRoom();
    // Connect to the online server right away: a sleeping free host starts
    // waking up while the player is still reading this page.
    setNetMode('online');
  }, []);

  const enter = async (kind: 'create' | 'solo' | 'join') => {
    primeAudio();
    setBusy(true);
    const profile: Identity = { ...identity, name: identity.name.trim() || 'Tycoon' };
    saveProfile(profile);
    setProfile(profile);
    setNetMode(kind === 'solo' ? 'solo' : 'online');

    const res =
      kind === 'join'
        ? await api.joinRoom(code.trim().toUpperCase(), profile)
        : await api.createRoom(profile, settings);
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
    navigate(`/${getNetMode() === 'solo' ? 'solo' : 'room'}/${res.data.roomCode}`);
  };

  const openSetup = (kind: 'create' | 'solo') => {
    setSettings({ ...DEFAULT_SETTINGS });
    setDialog(kind);
  };
  const waking = ONLINE_AVAILABLE && status !== 'online';
  const busyLabel = (idle: string, working: string) =>
    !busy ? idle : dialog !== 'solo' && waking ? 'Waking the server...' : working;

  return (
    <div className="relative min-h-full overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <PreviewScene />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/80 via-white/35 to-transparent" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-6 sm:px-10">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-neon-cyan to-neon-violet font-display text-base font-bold text-white shadow-glass">
              ST
            </div>
            <span className="font-display text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Skyline Tycoon
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ConnectionBadge />
            <button type="button" className="btn-ghost btn-sm" onClick={() => setDialog('rules')}>
              How to play
            </button>
          </div>
        </header>

        <main className="flex flex-1 flex-col justify-center py-10">
          <motion.div className="max-w-3xl" variants={hero} initial="hidden" animate="show">
            <motion.span variants={rise} className="chip inline-flex border-sky-200 bg-white/80 text-sm text-sky-700">
              {ONLINE_AVAILABLE
                ? 'Real-time 3D board game for 2 to 4 players'
                : '3D board game: you against up to three bots'}
            </motion.span>
            <motion.h1
              variants={rise}
              className="mt-5 font-display text-5xl font-bold leading-[1.05] tracking-tight text-slate-900 sm:text-7xl"
            >
              Build the skyline.
              <br />
              <span className="bg-gradient-to-r from-neon-cyan via-neon-violet to-neon-gold bg-clip-text text-transparent">
                Outlast your friends.
              </span>
            </motion.h1>
            <motion.p
              variants={rise}
              className="mt-5 max-w-2xl text-balance text-lg leading-relaxed text-slate-700 sm:text-xl"
            >
              Claim cities around the world, build them up, buy your rivals out and race for a side,
              triple or resort monopoly.{' '}
              {BOTH
                ? 'Invite friends to a private online room, or play solo against bots right here in your browser.'
                : SOLO_AVAILABLE
                  ? 'This edition runs entirely in your browser: pick your bots and play.'
                  : 'Private rooms, bots to fill empty seats, and a server that referees every roll.'}
            </motion.p>

            <motion.div variants={rise} className="mt-8 flex flex-wrap gap-3">
              {ONLINE_AVAILABLE ? (
                <>
                  <button
                    type="button"
                    className="btn-primary px-8 py-3.5 text-xl"
                    disabled={busy}
                    onClick={() => openSetup('create')}
                  >
                    {BOTH ? 'Play online' : 'Play now'}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost px-8 py-3.5 text-xl"
                    onClick={() => setDialog('join')}
                  >
                    Join with a code
                  </button>
                </>
              ) : null}
              {SOLO_AVAILABLE && (
                <button
                  type="button"
                  className={cx(BOTH ? 'btn-ghost' : 'btn-primary', 'px-8 py-3.5 text-xl')}
                  disabled={busy}
                  onClick={() => openSetup('solo')}
                >
                  {BOTH ? 'Play solo vs bots' : 'Play now'}
                </button>
              )}
            </motion.div>
            {BOTH && waking && (
              <motion.p variants={rise} className="mt-4 max-w-2xl text-base text-slate-600">
                Waking the online server. Free hosting sleeps when nobody is playing, so this can
                take up to a minute. Solo games start right away.
              </motion.p>
            )}

            <motion.dl variants={rise} className="mt-12 grid max-w-2xl grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
              {[
                ['32', 'spaces'],
                ['8', 'countries'],
                ['4', 'resorts'],
                [formatCompact(DEFAULT_SETTINGS.startingCash), 'to start'],
              ].map(([value, label]) => (
                <div key={label}>
                  <dt className="font-display text-3xl font-bold text-slate-900 sm:text-4xl">{value}</dt>
                  <dd className="text-sm font-bold uppercase tracking-wider text-slate-600">{label}</dd>
                </div>
              ))}
            </motion.dl>
          </motion.div>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-300/70 pt-4 text-sm text-slate-600">
          <span>An original property trading game. Every graphic is drawn in your browser.</span>
          <span>
            {ONLINE_AVAILABLE
              ? 'Server-authoritative dice, money and deeds.'
              : 'No server needed: the referee runs in this tab.'}
          </span>
        </footer>
      </div>

      <Modal
        open={dialog === 'create' || dialog === 'solo'}
        onClose={() => setDialog('none')}
        title={dialog === 'solo' ? 'Set up a solo game' : 'Create a private room'}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setDialog('none')}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={() => void enter(dialog === 'solo' ? 'solo' : 'create')}
            >
              {busyLabel(dialog === 'solo' ? 'Continue' : 'Create room', 'Creating...')}
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
              {busyLabel('Join room', 'Joining...')}
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
              className="field mt-2 text-center font-mono text-3xl tracking-[0.4em]"
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
