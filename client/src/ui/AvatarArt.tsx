import type { TokenShape } from '@shared';

/**
 * Four original cartoon characters, one per playing piece. Simple flat
 * shapes so they stay crisp from a 20px chip up to a large portrait.
 */

interface Look {
  skin: string;
  hair: string;
}

const LOOKS: Record<TokenShape, Look> = {
  tower: { skin: '#f2c29b', hair: '#3b2a20' },
  spire: { skin: '#c98a5f', hair: '#1f1a17' },
  dome: { skin: '#8d5a3b', hair: '#2a1d16' },
  prism: { skin: '#f7d7b5', hair: '#d9822b' },
};

function Face({ skin }: { skin: string }) {
  return (
    <g>
      <circle cx="32" cy="38" r="15" fill={skin} />
      <ellipse cx="26.5" cy="37" rx="1.9" ry="2.4" fill="#1e293b" />
      <ellipse cx="37.5" cy="37" rx="1.9" ry="2.4" fill="#1e293b" />
      <circle cx="23.5" cy="42" r="2.4" fill="#f87171" opacity="0.35" />
      <circle cx="40.5" cy="42" r="2.4" fill="#f87171" opacity="0.35" />
      <path d="M27 44 Q32 48.5 37 44" stroke="#1e293b" strokeWidth="2" fill="none" strokeLinecap="round" />
    </g>
  );
}

/** The mogul: neat side parting and a tall top hat. */
function Mogul({ look }: { look: Look }) {
  return (
    <g>
      <Face skin={look.skin} />
      <path d="M17 34 Q20 23 32 23 Q44 23 47 34 Q40 28 32 29 Q24 28 17 34Z" fill={look.hair} />
      <rect x="17" y="21" width="30" height="4" rx="2" fill="#1e293b" />
      <rect x="22" y="6" width="20" height="16" rx="2" fill="#1e293b" />
      <rect x="22" y="17" width="20" height="3" fill="#e11d48" />
    </g>
  );
}

/** The pilot: a peaked cap with a little gold wing badge. */
function Pilot({ look }: { look: Look }) {
  return (
    <g>
      <Face skin={look.skin} />
      <path d="M16 30 Q17 15 32 14 Q47 15 48 30Z" fill="#1d4ed8" />
      <path d="M14 30 Q32 25 50 30 Q50 33 48 33 Q32 29 16 33 Q14 33 14 30Z" fill="#0f172a" />
      <path d="M26 21 L32 18 L38 21 L32 23Z" fill="#fbbf24" />
    </g>
  );
}

/** The explorer: a wide-brimmed sun hat. */
function Explorer({ look }: { look: Look }) {
  return (
    <g>
      <Face skin={look.skin} />
      <ellipse cx="32" cy="27" rx="22" ry="5" fill="#a16207" />
      <path d="M19 27 Q20 11 32 11 Q44 11 45 27Z" fill="#ca8a04" />
      <rect x="19.5" y="22" width="25" height="3.5" fill="#78350f" />
    </g>
  );
}

/** The inventor: wild curls and goggles pushed up on the forehead. */
function Inventor({ look }: { look: Look }) {
  return (
    <g>
      <Face skin={look.skin} />
      {[18, 24, 30, 36, 42, 46].map((x, i) => (
        <circle key={x} cx={x} cy={i % 2 ? 22 : 25} r="6" fill={look.hair} />
      ))}
      <rect x="18" y="26" width="28" height="4" rx="2" fill="#334155" />
      <circle cx="26" cy="28" r="5" fill="#7dd3fc" stroke="#334155" strokeWidth="2.5" />
      <circle cx="38" cy="28" r="5" fill="#7dd3fc" stroke="#334155" strokeWidth="2.5" />
    </g>
  );
}

export function AvatarArt({ token, color, size }: { token: TokenShape; color: string; size: number }) {
  const look = LOOKS[token];
  const id = `bg-${token}-${color.replace('#', '')}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.55" />
          <stop offset="1" stopColor={color} />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="64" height="64" rx="14" fill={`url(#${id})`} />
      <path d="M12 64 Q12 52 32 51 Q52 52 52 64Z" fill="#ffffff" opacity="0.85" />
      {token === 'tower' && <Mogul look={look} />}
      {token === 'spire' && <Pilot look={look} />}
      {token === 'dome' && <Explorer look={look} />}
      {token === 'prism' && <Inventor look={look} />}
    </svg>
  );
}
