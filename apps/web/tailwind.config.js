/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/taskflow/**/*.{ts,tsx}'],
  darkMode: ['selector', '#taskflow-root.dark'],
  important: '#taskflow-root',
  corePlugins: { preflight: false },
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        ink: {
          950: '#0a0a10',
          900: '#101018',
          850: '#14141e',
          800: '#1a1a26',
          700: '#262636',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.05)',
        'card-hover': '0 4px 6px -2px rgba(16, 24, 40, 0.04), 0 12px 24px -4px rgba(16, 24, 40, 0.08)',
        pop: '0 20px 48px -12px rgba(16, 24, 40, 0.25), 0 4px 12px -4px rgba(16, 24, 40, 0.08)',
        glow: '0 8px 24px -6px rgba(124, 58, 237, 0.45)',
      },
      keyframes: {
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
      },
    },
  },
  plugins: [],
}
