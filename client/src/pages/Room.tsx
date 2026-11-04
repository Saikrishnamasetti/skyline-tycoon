import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Identity } from '@shared';
import { Lobby } from '../components/Lobby';
import { GameTable } from '../components/GameTable';
import { IdentityPicker } from '../components/IdentityPicker';
import { ConnectionBadge } from '../components/ConnectionBadge';
import { api, forgetSeat, loadProfile, recallSeat, rememberSeat, saveProfile } from '../net/socket';
import { LOCAL_MODE } from '../net/mode';

/** In the single-device build nobody else can be in a room you never sat at. */
const LOCAL_GONE = 'That game is not saved on this device any more.';
import { primeAudio } from '../lib/audio';
import { useGame } from '../store/useGame';

type Stage = 'resolving' | 'need-identity' | 'seated' | 'gone';

/**
 * Owns the join / rejoin handshake for a room URL. A refresh finds the stored
 * session token and reclaims the same seat rather than creating a new player.
 */
export function Room() {
  const params = useParams<{ code: string }>();
  const code = (params.code ?? '').toUpperCase();
  const navigate = useNavigate();

  const state = useGame((s) => s.state);
  const playerId = useGame((s) => s.playerId);
  const applyState = useGame((s) => s.applyState);
  const setSeat = useGame((s) => s.setSeat);
  const clearRoom = useGame((s) => s.clearRoom);
  const pushToast = useGame((s) => s.pushToast);

  const [stage, setStage] = useState<Stage>('resolving');
  const [identity, setIdentity] = useState<Identity>(() => loadProfile());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const attempted = useRef(false);

  const me = useMemo(
    () => state?.players.find((p) => p.id === playerId) ?? null,
    [state, playerId],
  );

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    if (!/^[A-Z0-9]{6}$/.test(code)) {
      setError('That room code does not look right.');
      setStage('gone');
      return;
    }
    // Already seated from the landing page: nothing to do.
    if (playerId && state?.roomCode === code) {
      setStage('seated');
      return;
    }
    const seat = recallSeat(code);
    if (!seat) {
      if (LOCAL_MODE) {
        setError(LOCAL_GONE);
        setStage('gone');
      } else {
        setStage('need-identity');
      }
      return;
    }
    void api.rejoinRoom(code, seat.sessionToken).then((res) => {
      if (res.ok && res.data) {
        setSeat(res.data.roomCode, res.data.playerId);
        applyState(res.data.state);
        setStage('seated');
      } else {
        forgetSeat(code);
        if (LOCAL_MODE) {
          setError(LOCAL_GONE);
          setStage('gone');
        } else {
          setStage('need-identity');
        }
      }
    });
  }, [code, playerId, state?.roomCode, applyState, setSeat]);

  const join = async () => {
    primeAudio();
    setBusy(true);
    const profile: Identity = { ...identity, name: identity.name.trim() || 'Tycoon' };
    saveProfile(profile);
    const res = await api.joinRoom(code, profile);
    setBusy(false);
    if (!res.ok || !res.data) {
      setError(res.error ?? 'Could not join that room.');
      return;
    }
    rememberSeat(res.data.roomCode, {
      playerId: res.data.playerId,
      sessionToken: res.data.sessionToken,
    });
    setSeat(res.data.roomCode, res.data.playerId);
    applyState(res.data.state);
    setStage('seated');
  };

  const leave = () => {
    void api.leaveRoom();
    forgetSeat(code);
    clearRoom();
    navigate('/');
  };

  if (stage === 'resolving' || (stage === 'seated' && !state)) {
    return <Splash message="Finding your seat..." />;
  }

  if (stage === 'gone') {
    return (
      <Splash message={error ?? 'That room is no longer available.'}>
        <button type="button" className="btn-primary mt-4" onClick={() => navigate('/')}>
          Back to the start
        </button>
      </Splash>
    );
  }

  if (stage === 'need-identity') {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-5 py-10">
        <div className="panel p-7">
          <h1 className="font-display text-3xl font-bold text-slate-900">Join room {code}</h1>
          <p className="mt-1.5 text-base text-slate-600">
            Pick a name and a piece, then take your seat.
          </p>
          <div className="mt-5">
            <IdentityPicker value={identity} onChange={setIdentity} />
          </div>
          {error && (
            <p className="mt-4 rounded-xl border-2 border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700" role="alert">
              {error}
            </p>
          )}
          <div className="mt-5 flex gap-2">
            <button type="button" className="btn-ghost flex-1" onClick={() => navigate('/')}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary flex-1"
              disabled={busy}
              onClick={() => void join()}
            >
              {busy ? 'Joining...' : 'Take a seat'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!state) return <Splash message="Waiting for the table..." />;

  if (state.status === 'lobby') {
    return <Lobby state={state} me={me} onLeave={leave} />;
  }

  return (
    <div className="h-screen w-screen">
      <GameTable state={state} me={me} onLeave={leave} />
    </div>
  );
}

function Splash({ message, children }: { message: string; children?: React.ReactNode }) {
  useEffect(() => {
    void 0;
  }, []);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="flex h-16 w-16 animate-float items-center justify-center rounded-3xl bg-gradient-to-br from-neon-cyan to-neon-violet font-display text-xl font-bold text-white shadow-glass">
        ST
      </div>
      <p className="text-lg font-semibold text-slate-700">{message}</p>
      <ConnectionBadge />
      {children}
    </div>
  );
}
