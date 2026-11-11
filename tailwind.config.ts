import type { Config } from 'tailwindcss';

const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /** The sea: page background. */
        paper: token('paper'),
        /** Land: raised surfaces. */
        island: token('island'),
        /** Text and hairlines. */
        ink: token('ink'),
        dim: token('dim'),
        accent: token('accent'),
        'on-accent': token('on-accent'),
        gold: token('gold'),
        ok: token('ok'),
        danger: token('danger'),
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Impact', 'sans-serif'],
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      transitionTimingFunction: {
        expo: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      boxShadow: {
        print: '4px 4px 0 rgb(var(--ink))',
        'print-sm': '2px 2px 0 rgb(var(--ink))',
      },
    },
  },
  plugins: [],
};

export default config;
