import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', 'Segoe UI', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']
      },
      boxShadow: {
        soft: '0 10px 30px -20px rgba(2, 14, 28, 0.45)',
        panel: '0 30px 80px -40px rgba(8, 23, 45, 0.55)'
      }
    }
  },
  plugins: []
};

export default config;
