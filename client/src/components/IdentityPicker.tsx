import { PLAYER_COLORS, TOKEN_SHAPES } from '@shared';
import type { Identity, PlayerColorId, TokenShape } from '@shared';
import { cx } from '../lib/format';
import { CheckIcon } from '../ui/Icons';

interface IdentityPickerProps {
  value: Identity;
  onChange: (next: Identity) => void;
  takenColors?: PlayerColorId[];
  takenTokens?: TokenShape[];
  compact?: boolean;
}

const TOKEN_GLYPH: Record<TokenShape, string> = {
  tower: 'M6 20V9h4v11M14 20V4h4v16',
  spire: 'M12 3l5 17H7z',
  dome: 'M4 20h16M6 20a6 6 0 0112 0',
  prism: 'M12 3l7 9-7 9-7-9z',
};

export function IdentityPicker({
  value,
  onChange,
  takenColors = [],
  takenTokens = [],
  compact = false,
}: IdentityPickerProps) {
  return (
    <div className={cx('space-y-3', compact && 'space-y-2')}>
      <div>
        <label className="label" htmlFor="nickname">
          Nickname
        </label>
        <input
          id="nickname"
          className="field mt-2 text-lg"
          maxLength={16}
          value={value.name}
          placeholder="Who are you today?"
          onChange={(event) => onChange({ ...value, name: event.target.value })}
        />
      </div>

      <div>
        <span className="label">Colour</span>
        <div className="mt-2 flex flex-wrap gap-3">
          {PLAYER_COLORS.map((color) => {
            const taken = takenColors.includes(color.id) && value.color !== color.id;
            const selected = value.color === color.id;
            return (
              <button
                key={color.id}
                type="button"
                disabled={taken}
                onClick={() => onChange({ ...value, color: color.id })}
                title={taken ? `${color.label} is taken` : color.label}
                className={cx(
                  'option flex h-12 w-12 items-center justify-center text-white',
                  selected
                    ? 'scale-105 border-white ring-4 ring-offset-2'
                    : 'border-white hover:scale-105',
                  taken && 'cursor-not-allowed opacity-25',
                )}
                style={{
                  background: `linear-gradient(140deg, ${color.hex}, ${color.glow})`,
                  boxShadow: selected ? `0 6px 18px -4px ${color.hex}` : '0 2px 0 rgba(15,23,42,0.12)',
                  ['--tw-ring-color' as string]: color.hex,
                }}
                aria-label={color.label}
                aria-pressed={selected}
              >
                {/* The choice is marked by a tick, not by colour alone. */}
                {selected && <CheckIcon size={20} />}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <span className="label">Playing piece</span>
        <div className="mt-2 flex flex-wrap gap-3">
          {TOKEN_SHAPES.map((token) => {
            const taken = takenTokens.includes(token.id) && value.token !== token.id;
            return (
              <button
                key={token.id}
                type="button"
                disabled={taken}
                onClick={() => onChange({ ...value, token: token.id })}
                title={taken ? `${token.label} is taken` : token.label}
                className={cx(
                  'option flex h-12 w-14 items-center justify-center',
                  value.token === token.id
                    ? 'border-sky-400 bg-sky-50 text-sky-600'
                    : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50',
                  taken && 'cursor-not-allowed opacity-25',
                )}
                aria-label={token.label}
                aria-pressed={value.token === token.id}
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d={TOKEN_GLYPH[token.id]}
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
