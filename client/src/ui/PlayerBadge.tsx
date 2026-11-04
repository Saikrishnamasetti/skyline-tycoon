import { COLOR_HEX, formatMoney, playerHoldings } from '@shared';
import type { GameState, Player } from '@shared';
import { cx } from '../lib/format';
import { AvatarArt } from './AvatarArt';

export type Corner = 'tl' | 'tr' | 'br' | 'bl';

/**
 * A player's portrait, name and wallet, pinned to a corner of the table.
 * The player whose turn it is bounces gently and gets a glowing frame.
 */
export function PlayerBadge({
  state,
  player,
  corner,
  isMe,
  compact = false,
  onClick,
}: {
  state: GameState;
  player: Player;
  corner: Corner;
  isMe: boolean;
  compact?: boolean;
  onClick?: () => void;
}) {
  const hex = COLOR_HEX[player.color];
  const isCurrent = state.status === 'playing' && state.order[state.currentIndex] === player.id;
  const deeds = playerHoldings(state, player.id).length;
  const right = corner === 'tr' || corner === 'br';
  const size = compact ? 44 : 66;

  const status = player.bankrupt
    ? 'BANKRUPT'
    : !player.connected
      ? 'AWAY'
      : player.onIsland
        ? 'ISLAND'
        : player.isBot
          ? 'BOT'
          : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'pointer-events-auto flex items-center gap-2 text-left',
        right && 'flex-row-reverse text-right',
        player.bankrupt && 'opacity-50 grayscale',
      )}
    >
      <span
        className={cx('relative shrink-0 rounded-2xl p-[3px] transition-transform', isCurrent && 'animate-float')}
        style={{
          background: isCurrent ? `linear-gradient(135deg, #fde68a, ${hex})` : '#ffffff',
          boxShadow: isCurrent ? `0 0 0 3px ${hex}55, 0 10px 22px -8px ${hex}` : '0 4px 0 rgba(15,23,42,0.12)',
        }}
      >
        <span className="block overflow-hidden rounded-xl">
          <AvatarArt token={player.token} color={hex} size={size} />
        </span>
        {status && (
          <span
            className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-1.5 py-px font-display text-[9px] font-semibold text-white"
            style={{ background: player.bankrupt ? '#e11d48' : '#334155' }}
          >
            {status}
          </span>
        )}
      </span>
      <span className={cx('flex min-w-0 flex-col gap-1', right ? 'items-end' : 'items-start')}>
        <span
          className="max-w-[9rem] truncate rounded-full px-2.5 py-0.5 font-display text-[12px] font-semibold text-white shadow-sm"
          style={{ background: hex }}
        >
          {player.name}
          {isMe ? ' (you)' : ''}
        </span>
        <span className="rounded-full border-2 border-white bg-white/95 px-2.5 py-0.5 font-display text-[14px] font-bold tabular-nums text-slate-800 shadow-glass">
          {formatMoney(player.cash)}
        </span>
        {!compact && (
          <span className="text-[11px] font-bold text-slate-600 drop-shadow-sm">
            {deeds} {deeds === 1 ? 'property' : 'properties'}
            {player.escapeCards > 0 ? ' - escape card' : ''}
            {player.shieldCards > 0 ? ' - rent pass' : ''}
          </span>
        )}
      </span>
    </button>
  );
}
