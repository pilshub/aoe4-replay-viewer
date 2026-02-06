/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'aoe-bg': '#0a0e17',
        'aoe-panel': '#111827',
        'aoe-border': '#1e293b',
        'aoe-gold': '#d4a853',
        'aoe-blue': '#3b82f6',
        'aoe-red': '#ef4444',
      },
    },
  },
  plugins: [],
};
