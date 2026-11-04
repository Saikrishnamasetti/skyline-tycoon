import { PLAYER_COLORS, TOKEN_SHAPES } from '@shared';
import type { Identity, PlayerColorId, TokenShape } from '@shared';
import { cx } from '../lib/format';

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
          className="field mt-1.5"
          maxLength={16}
          value={value.name}
          placeholder="Who are you today?"
          onChange={(event) => onChange({ ...value, name: event.target.value })}
        />
      </div>

      <div>
        <span className="label">Colour</span>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {PLAYER_COLORS.map((color) => {
            const taken = takenColors.includes(color.id) && value.color !== color.id;
            return (
              <button
                key={color.id}
                type="button"
                disabled={taken}
                onClick={() => onChange({ ...value, color: color.id })}
                title={taken ? `${color.label} is taken` : color.label}
                className={cx(
                  'h-10 w-10 rounded-xl border-2 transition-all',
                  value.color === color.id
                    ? 'scale-105 border-slate-2000'
                    : 'border-slate-200 hover:border-white/35',
                  taken && 'cursor-not-allowed opacity-25',
                )}
                style={{
                  background: `linear-gradient(140deg, ${color.hex}, ${color.glow})`,
                  boxShadow: value.color === color.id ? `0 0 18px -3px ${color.hex}` : undefined,
                }}
                aria-label={color.label}
              />
            );
          })}
        </div>
      </div>

      <div>
        <span className="label">Playing piece</span>
        <div className="mt-1.5 flex flex-wrap gap-2">
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
                  'flex h-10 w-12 items-center justify-center rounded-xl border transition',
                  value.token === token.id
                    ? 'border-neon-cyan/70 bg-neon-cyan/12 text-neon-cyan'
                    : 'border-slate-200 bg-slate-100 text-slate-500 hover:bg-slate-100',
                  taken && 'cursor-not-allowed opacity-25',
                )}
                aria-label={token.label}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
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
