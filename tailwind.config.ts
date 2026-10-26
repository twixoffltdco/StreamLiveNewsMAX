import type { Config } from 'tailwindcss';

/**
 * Zoomer 2026 dark theme «StreamLive»:
 * чистый чёрный фон, неоновые циан/розовый акценты, моноширинный «терминальный» стиль.
 * При этом базовая типографика крупная и контрастная — понятна всем возрастам.
 */
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: '#000000',
        panel: '#0a0a0c',
        line: '#1d1d24',
        neon: {
          cyan: '#00e5ff',
          pink: '#ff2d78',
          violet: '#8b5cf6',
          green: '#39ff88',
          amber: '#ffb020',
          blue: '#00a2ff', // VK / MAX акценты кнопок подписки
        },
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        neon: '0 0 12px rgba(0,229,255,0.25), 0 0 32px rgba(255,45,120,0.12)',
      },
    },
  },
  plugins: [],
};

export default config;
