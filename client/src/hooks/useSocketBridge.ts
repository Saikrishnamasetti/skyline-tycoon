import { useEffect } from 'react';
import { getSocket, recallSeat, api, forgetSeat } from '../net/socket';
import { useNetMode } from '../net/mode';
import { useGame } from '../store/useGame';

/**
 * Wires the active socket to the store, and rewires it when the player
 * switches between an online and a solo game. Reconnections automatically
 * reclaim the player's seat with the stored session token, which is what
 * stops a browser refresh from creating a second player.
 */
export function useSocketBridge(): void {
  const mode = useNetMode();
  useEffect(() => {
    const socket = getSocket();
    const store = useGame.getState();

    const onConnect = () => {
      useGame.getState().setStatus('online');
      const code = useGame.getState().roomCode;
      if (!code) return;
      const seat = recallSeat(code);
      if (!seat) return;
      void api.rejoinRoom(code, seat.sessionToken).then((res) => {
        if (res.ok && res.data) {
          useGame.getState().setSeat(res.data.roomCode, res.data.playerId);
          useGame.getState().applyState(res.data.state);
        } else {
          forgetSeat(code);
        }
      });
    };

    const onDisconnect = () => useGame.getState().setStatus('offline');
    const onState = (state: Parameters<typeof store.applyState>[0]) =>
      useGame.getState().applyState(state);
    const onEvents = (events: Parameters<typeof store.applyEvents>[0]) =>
      useGame.getState().applyEvents(events);
    const onKicked = (payload: { reason: string }) => {
      useGame.getState().pushToast({ title: 'Disconnected', detail: payload.reason, tone: 'bad' });
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('state', onState);
    socket.on('events', onEvents);
    socket.on('kicked', onKicked);
    useGame.getState().setStatus(socket.connected ? 'online' : 'connecting');

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('state', onState);
      socket.off('events', onEvents);
      socket.off('kicked', onKicked);
    };
  }, [mode]);
}
