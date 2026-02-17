/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'aoe-bg': '#0d0d12',
        'aoe-panel': '#1a1a24',
        'aoe-panel-hover': '#22222f',
        'aoe-border': '#2a2a35',
        'aoe-gold': '#c9a84c',
        'aoe-gold-light': '#e4c76b',
        'aoe-gold-dark': '#8a6d2b',
        'aoe-parchment': '#f5e6c8',
        'aoe-text': '#e8e0d0',
        'aoe-text-secondary': '#9a9284',
        'aoe-text-dim': '#7a756b',
        'aoe-blue': '#3b82f6',
        'aoe-red': '#ef4444',
      },
      fontFamily: {
        cinzel: ['Cinzel', 'Georgia', 'serif'],
        crimson: ['"Crimson Text"', 'Georgia', 'serif'],
      },
      boxShadow: {
        'gold-glow': '0 0 40px rgba(201, 168, 76, 0.15)',
        'gold-glow-lg': '0 0 60px rgba(201, 168, 76, 0.2)',
      },
    },
  },
  plugins: [],
};
