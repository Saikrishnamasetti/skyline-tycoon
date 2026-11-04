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
  mini = false,
  onClick,
}: {
  state: GameState;
  player: Player;
  corner: Corner;
  isMe: boolean;
  compact?: boolean;
  /** The smallest size, for the row of seats across the top of a phone. */
  mini?: boolean;
  onClick?: () => void;
}) {
  const hex = COLOR_HEX[player.color];
  const isCurrent = state.status === 'playing' && state.order[state.currentIndex] === player.id;
  const deeds = playerHoldings(state, player.id).length;
  const right = corner === 'tr' || corner === 'br';
  const size = mini ? 40 : compact ? 52 : 80;

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
        'pointer-events-auto flex items-center rounded-2xl text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-300',
        mini ? 'gap-1.5' : 'gap-2.5',
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
            className={cx(
              'absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-px font-display text-xs font-semibold tracking-wide text-white shadow-sm',
              mini ? '-bottom-1.5 px-1.5 leading-4' : '-bottom-2',
            )}
            style={{ background: player.bankrupt ? '#e11d48' : '#334155' }}
          >
            {status}
          </span>
        )}
      </span>
      <span className={cx('flex min-w-0 flex-col', mini ? 'gap-0.5' : 'gap-1', right ? 'items-end' : 'items-start')}>
        <span
          className={cx(
            'truncate rounded-full py-0.5 font-display font-semibold text-white shadow-sm',
            mini ? 'max-w-[6.5rem] px-2 text-xs' : compact ? 'max-w-[8.5rem] px-3 text-sm' : 'max-w-[11rem] px-3 text-base',
          )}
          style={{ background: hex }}
          title={player.name}
        >
          {player.name}
          {isMe ? ' (you)' : ''}
        </span>
        <span
          className={cx(
            'rounded-full border-2 border-white bg-white/95 py-0.5 font-display font-bold tabular-nums text-slate-800 shadow-glass',
            mini ? 'px-2 text-sm' : compact ? 'px-3 text-base' : 'px-3 text-lg',
          )}
        >
          {formatMoney(player.cash)}
        </span>
        {!compact && !mini && (
          <span className="rounded-full bg-white/70 px-2.5 py-0.5 text-sm font-bold text-slate-700 backdrop-blur-sm">
            {deeds} {deeds === 1 ? 'property' : 'properties'}
            {player.escapeCards > 0 ? ' - escape card' : ''}
            {player.shieldCards > 0 ? ' - rent pass' : ''}
          </span>
        )}
      </span>
    </button>
  );
}
