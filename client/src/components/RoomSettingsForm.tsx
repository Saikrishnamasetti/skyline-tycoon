import { SETTINGS_BOUNDS, formatCompact } from '@shared';
import type { GameSettings } from '@shared';
import { cx } from '../lib/format';

interface Props {
  value: GameSettings;
  onChange: (next: GameSettings) => void;
  disabled?: boolean;
}

/** Host-only table setup. The server clamps every value again on arrival. */
export function RoomSettingsForm({ value, onChange, disabled = false }: Props) {
  const set = <K extends keyof GameSettings>(key: K, next: GameSettings[K]) =>
    onChange({ ...value, [key]: next });

  return (
    <fieldset disabled={disabled} className={cx('space-y-5', disabled && 'opacity-60')}>
      <div>
        <span className="label">Players</span>
        <div className="mt-2 flex gap-2">
          {[2, 3, 4].map((count) => (
            <button
              key={count}
              type="button"
              onClick={() => set('maxPlayers', count)}
              aria-pressed={value.maxPlayers === count}
              className={cx(
                'option min-h-[2.75rem] flex-1 px-3 py-2 font-display text-lg font-semibold',
                value.maxPlayers === count
                  ? 'border-sky-400 bg-sky-50 text-sky-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
              )}
            >
              {count}
            </button>
          ))}
        </div>
      </div>

      <Slider
        label="Starting cash"
        display={formatCompact(value.startingCash)}
        bounds={SETTINGS_BOUNDS.startingCash}
        value={value.startingCash}
        onChange={(next) => set('startingCash', next)}
      />
      <Slider
        label="Salary for passing Start"
        display={formatCompact(value.salary)}
        bounds={SETTINGS_BOUNDS.salary}
        value={value.salary}
        onChange={(next) => set('salary', next)}
      />
      <Slider
        label="Turn timer"
        display={`${value.turnSeconds}s`}
        bounds={SETTINGS_BOUNDS.turnSeconds}
        value={value.turnSeconds}
        onChange={(next) => set('turnSeconds', next)}
      />
      <Slider
        label="Match length"
        display={value.matchMinutes === 0 ? 'No limit' : `${value.matchMinutes} minutes`}
        bounds={SETTINGS_BOUNDS.matchMinutes}
        value={value.matchMinutes}
        onChange={(next) => set('matchMinutes', next)}
      />

      <button
        type="button"
        role="switch"
        aria-checked={value.tradingEnabled}
        onClick={() => set('tradingEnabled', !value.tradingEnabled)}
        className="option flex w-full items-start gap-3 border-slate-200 bg-slate-50 px-4 py-3 text-left hover:bg-slate-100"
      >
        <span
          className={cx(
            'mt-0.5 flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition',
            value.tradingEnabled ? 'bg-sky-500' : 'bg-slate-300',
          )}
        >
          <span className={cx('h-5 w-5 rounded-full bg-white shadow transition-transform', value.tradingEnabled && 'translate-x-5')} />
        </span>
        <span className="min-w-0">
          <span className="block text-base font-semibold text-slate-900">Allow trading (house rule)</span>
          <span className="block text-sm leading-snug text-slate-500">
            Off in the classic game. When on, players can swap cash and cities before they roll.
          </span>
        </span>
      </button>
    </fieldset>
  );
}

function Slider({
  label,
  display,
  bounds,
  value,
  onChange,
}: {
  label: string;
  display: string;
  bounds: { min: number; max: number; step: number };
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="label">{label}</span>
        <span className="rounded-lg bg-slate-100 px-2 py-0.5 font-mono text-sm font-bold text-slate-800">{display}</span>
      </div>
      <input
        type="range"
        className="mt-2 h-2 w-full cursor-pointer accent-sky-500"
        min={bounds.min}
        max={bounds.max}
        step={bounds.step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={label}
      />
    </div>
  );
}
