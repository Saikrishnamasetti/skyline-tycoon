import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { COLOR_HEX, GROUPS, TILE_ACCENT, formatMoney } from '@shared';
import type { GameState, Player, PlayerColorId, Tile } from '@shared';
import { cx } from '../lib/format';
import { AvatarArt } from './AvatarArt';
import { CloseIcon } from './Icons';

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
  return <span className="inline-block h-3 w-3 shrink-0 rounded-[4px]" style={{ background: color }} />;
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
    <svg
      width={size}
      height={size}
      className={cx('shrink-0', urgent && 'animate-pulse')}
      role="timer"
      aria-label={`${seconds} seconds left`}
    >
      <circle cx={size / 2} cy={size / 2} r={radius} fill="#f8fafc" stroke="#e2e8f0" strokeWidth={4} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={urgent ? '#e11d48' : '#0ea5e9'}
        strokeWidth={4}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - ratio)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 0.2s' }}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        fill={urgent ? '#e11d48' : '#334155'}
        fontSize={size * 0.36}
        fontWeight={800}
        fontFamily="Fredoka, Nunito, sans-serif"
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
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  // Callers often clear their content together with `open`. Keep showing the
  // last content while the dialog animates away so it does not blank out.
  const shown = useRef({ title, children, footer });
  if (open) shown.current = { title, children, footer };
  // Callers pass a fresh arrow each render; read it through a ref so the
  // effect below runs only when the dialog opens or closes.
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !dismissible) return;
      // Only the top-most dialog answers, so nested ones close one at a time.
      const dialogs = document.querySelectorAll('[data-modal-panel]');
      if (dialogs[dialogs.length - 1] !== panel.current) return;
      event.stopPropagation();
      close.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previous?.focus?.({ preventScroll: true });
    };
  }, [open, dismissible]);

  // Portalled to <body> so a dialog opened from inside another dialog is
  // still positioned against the viewport.
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-6">
          <motion.div
            className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            transition={{ duration: 0.2 }}
            onClick={dismissible ? onClose : undefined}
            aria-hidden
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            data-modal-panel
            className={cx(
              'glass-strong relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-3xl shadow-glass outline-none',
              wide ? 'max-w-4xl' : 'max-w-xl',
            )}
            initial={{ opacity: 0, scale: 0.94, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8, transition: { duration: 0.14 } }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          >
            <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
              <h2 id={titleId} className="font-display text-xl font-semibold text-slate-900 sm:text-2xl">
                {shown.current.title}
              </h2>
              {dismissible && (
                <button
                  type="button"
                  onClick={onClose}
                  className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-300"
                  aria-label="Close dialog"
                >
                  <CloseIcon />
                </button>
              )}
            </header>
            <div className="no-scrollbar flex-1 overflow-y-auto px-5 py-5 sm:px-6">{shown.current.children}</div>
            {shown.current.footer && (
              <footer className="border-t border-slate-200 px-5 py-4 sm:px-6">{shown.current.footer}</footer>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
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

/** A labelled figure for cards and summaries: small caption over a big number. */
export function Stat({
  label,
  value,
  tone = 'default',
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: 'default' | 'active' | 'gold';
  className?: string;
}) {
  return (
    <div
      className={cx(
        'rounded-2xl border-2 px-3 py-2.5',
        tone === 'active' && 'border-sky-300 bg-sky-50',
        tone === 'gold' && 'border-amber-300 bg-amber-50',
        tone === 'default' && 'border-slate-200 bg-slate-50',
        className,
      )}
    >
      <div
        className={cx(
          'text-caption font-bold uppercase tracking-wide',
          tone === 'active' ? 'text-sky-700' : tone === 'gold' ? 'text-amber-700' : 'text-slate-500',
        )}
      >
        {label}
      </div>
      <div className="mt-0.5 font-display text-xl font-bold tabular-nums text-slate-900">{value}</div>
    </div>
  );
}
