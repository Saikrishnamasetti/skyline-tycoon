import { cx } from '../lib/format';
import { useGame } from '../store/useGame';
import { LOCAL_MODE } from '../net/mode';

const LABEL = {
  idle: 'Connecting',
  connecting: 'Connecting',
  online: 'Connected',
  offline: 'Reconnecting',
} as const;

export function ConnectionBadge({ className }: { className?: string }) {
  const status = useGame((s) => s.status);
  if (LOCAL_MODE) {
    return (
      <span
        className={cx('chip border-emerald-400/30 text-emerald-700', className)}
        title="The game runs entirely in this browser tab"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        In your browser
      </span>
    );
  }
  const good = status === 'online';
  return (
    <span
      className={cx(
        'chip',
        good ? 'border-emerald-400/30 text-emerald-700' : 'border-amber-400/30 text-amber-700',
        className,
      )}
      title={good ? 'Live connection to the game server' : 'Trying to reach the game server'}
    >
      <span
        className={cx(
          'h-1.5 w-1.5 rounded-full',
          good ? 'bg-emerald-400' : 'animate-pulse bg-amber-400',
        )}
      />
      {LABEL[status]}
    </span>
  );
}
