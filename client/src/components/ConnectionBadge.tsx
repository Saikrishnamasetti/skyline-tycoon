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
        className={cx('chip border-emerald-300 bg-emerald-50 text-emerald-800', className)}
        title="The game runs entirely in this browser tab"
      >
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        In your browser
      </span>
    );
  }
  const good = status === 'online';
  return (
    <span
      className={cx(
        'chip',
        good ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-amber-300 bg-amber-50 text-amber-800',
        className,
      )}
      title={good ? 'Live connection to the game server' : 'Trying to reach the game server'}
    >
      <span
        className={cx(
          'h-2 w-2 rounded-full',
          good ? 'bg-emerald-400' : 'animate-pulse bg-amber-400',
        )}
      />
      {LABEL[status]}
    </span>
  );
}
