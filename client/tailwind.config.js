/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // The default scale jumps in fives; the UI leans on subtle 4-12% tints.
      opacity: Object.fromEntries(
        Array.from({ length: 101 }, (_, i) => [i, String(i / 100)]),
      ),
      fontFamily: {
        display: ['Fredoka', 'Nunito', 'system-ui', 'sans-serif'],
        sans: ['Nunito', 'system-ui', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        ink: {
          950: '#05070f',
          900: '#080c1a',
          800: '#0d1426',
          700: '#141d35',
          600: '#1d2947',
        },
        // Bright, saturated accents that read on a light, sunny table.
        neon: {
          cyan: '#0ea5e9',
          violet: '#8b5cf6',
          lime: '#16a34a',
          gold: '#f59e0b',
          rose: '#e11d48',
        },
      },
      boxShadow: {
        glass: '0 4px 0 rgba(15,23,42,0.06), 0 14px 32px -12px rgba(30,41,59,0.35)',
        glow: '0 0 0 4px rgba(14,165,233,0.35), 0 10px 24px -8px rgba(14,165,233,0.6)',
        'glow-soft': '0 0 18px -6px rgba(139,92,246,0.6)',
      },
      backgroundImage: {
        grid: 'linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(0.92)' },
          '60%': { opacity: '1', transform: 'scale(1.02)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in': {
          '0%': { opacity: '0', transform: 'translateX(24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'pulse-ring': {
          '0%': { boxShadow: '0 0 0 0 rgba(14,165,233,0.55)' },
          '70%': { boxShadow: '0 0 0 14px rgba(14,165,233,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(14,165,233,0)' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.35s ease-out both',
        'pop-in': 'pop-in 0.28s cubic-bezier(0.22,1,0.36,1) both',
        'slide-in': 'slide-in 0.3s ease-out both',
        'pulse-ring': 'pulse-ring 1.8s ease-out infinite',
        float: 'float 4s ease-in-out infinite',
        shimmer: 'shimmer 2.4s linear infinite',
      },
    },
  },
  plugins: [],
};
