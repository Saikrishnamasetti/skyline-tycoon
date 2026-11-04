import { useCallback } from 'react';
import type { GameAction } from '@shared';
import { api } from '../net/socket';
import { sfx } from '../lib/audio';
import { useGame } from '../store/useGame';

/**
 * Sends an action and surfaces the server's rejection reason. The client
 * never assumes an action succeeded - the next state broadcast is the truth.
 */
export function useActions() {
  const pushToast = useGame((s) => s.pushToast);
  const sound = useGame((s) => s.sound);

  return useCallback(
    async (action: GameAction): Promise<boolean> => {
      const res = await api.action(action);
      if (!res.ok) {
        if (sound) sfx.error();
        pushToast({
          title: 'That move is not allowed',
          detail: res.error ?? 'The server rejected the action',
          tone: 'bad',
        });
      }
      return res.ok;
    },
    [pushToast, sound],
  );
}
