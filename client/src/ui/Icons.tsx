/** Small line icons for the round buttons beside the table. */

const base = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export const SoundIcon = ({ muted }: { muted: boolean }) => (
  <svg {...base}>
    <path d="M4 9h4l5-4v14l-5-4H4z" />
    {muted ? <path d="M17 9l5 6M22 9l-5 6" /> : <path d="M17 8.5a5 5 0 010 7M19.5 6a8.5 8.5 0 010 12" />}
  </svg>
);

export const RecentreIcon = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="7" />
    <circle cx="12" cy="12" r="2" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
  </svg>
);

export const RulesIcon = () => (
  <svg {...base}>
    <path d="M5 4h10a4 4 0 014 4v12H9a4 4 0 01-4-4z" />
    <path d="M9 9h6M9 13h6" />
  </svg>
);

export const LogIcon = () => (
  <svg {...base}>
    <path d="M8 6h12M8 12h12M8 18h12" />
    <circle cx="4" cy="6" r="1" />
    <circle cx="4" cy="12" r="1" />
    <circle cx="4" cy="18" r="1" />
  </svg>
);

export const CitiesIcon = () => (
  <svg {...base}>
    <path d="M3 21h18M5 21V9l5-3v15M10 21V4l9 4v13" />
    <path d="M14 11h2M14 15h2" />
  </svg>
);

export const LeaveIcon = () => (
  <svg {...base}>
    <path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10" />
  </svg>
);
