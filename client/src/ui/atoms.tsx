import type { ReactNode } from 'react';
import { COLOR_HEX, GROUPS, TILE_ACCENT, formatMoney } from '@shared';
import type { GameState, Player, PlayerColorId, Tile } from '@shared';
import { cx } from '../lib/format';
import { AvatarArt } from './AvatarArt';

export function Avatar({
  player,
  size = 36,
  dim = false,
}: {
  player: Pick<Player, 'name' | 'color' | 'token'>;
  size?: number;
  dim?: boolean;
}) {
  const hex = COLOR_HEX[player.color as PlayerColorId] ?? '#3b82f6';
  return (
    <span
      className={cx('inline-flex shrink-0 overflow-hidden rounded-xl', dim && 'opacity-45 grayscale')}
      style={{ width: size, height: size, boxShadow: `0 2px 0 ${hex}55` }}
      title={player.name}
    >
      <AvatarArt token={player.token} color={hex} size={size} />
    </span>
  );
}

export function Money({
  amount,
  className,
  signed = false,
}: {
  amount: number;
  className?: string;
  signed?: boolean;
}) {
  return (
    <span className={cx('font-mono tabular-nums', className)}>
      {signed && amount > 0 ? '+' : ''}
      {formatMoney(amount)}
    </span>
  );
}

export function GroupDot({ tile }: { tile: Tile }) {
  const color =
    tile.kind === 'city' ? GROUPS[tile.group].color : tile.kind === 'resort' ? TILE_ACCENT.resort : '#64748b';
  return <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: color }} />;
}

/** A circular countdown that mirrors the server deadline. */
export function TimerRing({
  seconds,
  total,
  size = 40,
}: {
  seconds: number;
  total: number;
  size?: number;
}) {
  const radius = size / 2 - 3;
  const circumference = 2 * Math.PI * radius;
  const ratio = total > 0 ? Math.min(1, Math.max(0, seconds / total)) : 0;
  const urgent = seconds <= 5;
  return (
    <svg width={size} height={size} className="shrink-0" aria-hidden>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth={3}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={urgent ? '#ff7a9c' : '#4fd6ff'}
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - ratio)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.9s linear' }}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        fill={urgent ? '#ff7a9c' : '#cbd5f5'}
        fontSize={size * 0.34}
        fontWeight={700}
      >
        {seconds}
      </text>
    </svg>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide = false,
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  /**
   * When false the backdrop and the close control are inert, so a stray click
   * cannot make a decision for the player. Used by the game-over screen.
   */
  dismissible?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-6">
      {dismissible ? (
        <button
          type="button"
          aria-label="Close"
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          onClick={onClose}
        />
      ) : (
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
      )}
      <div
        role="dialog"
        aria-modal="true"
        className={cx(
          'glass-strong relative flex max-h-[88vh] w-full flex-col overflow-hidden rounded-3xl shadow-glass animate-pop-in',
          wide ? 'max-w-3xl' : 'max-w-lg',
        )}
      >
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <h2 className="font-display text-lg font-semibold text-slate-900">{title}</h2>
          {dismissible && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-2 py-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              aria-label="Close dialog"
            >
              &#10005;
            </button>
          )}
        </header>
        <div className="no-scrollbar flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <footer className="border-t border-slate-200 px-5 py-4">{footer}</footer>
        )}
      </div>
    </div>
  );
}

export function StatusPill({ state }: { state: GameState }) {
  const map: Record<string, { label: string; className: string }> = {
    pre_roll: { label: 'Waiting on the roll', className: 'text-neon-cyan' },
    build: { label: 'Building', className: 'text-neon-gold' },
    buyout: { label: 'Buyout offer', className: 'text-neon-gold' },
    championship: { label: 'Picking a championship city', className: 'text-neon-gold' },
    in_debt: { label: 'Debt to settle', className: 'text-neon-rose' },
    game_over: { label: 'Game over', className: 'text-neon-lime' },
    lobby: { label: 'In the lobby', className: 'text-slate-700' },
  };
  const entry = map[state.phase] ?? map.lobby;
  return <span className={cx('chip', entry.className)}>{entry.label}</span>;
}
