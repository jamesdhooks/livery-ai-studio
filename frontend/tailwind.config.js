/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-dark': 'rgb(var(--color-bg-dark) / <alpha-value>)',
        'bg-panel': 'rgb(var(--color-bg-panel) / <alpha-value>)',
        'bg-card': 'rgb(var(--color-bg-card) / <alpha-value>)',
        'bg-input': 'rgb(var(--color-bg-input) / <alpha-value>)',
        'bg-hover': 'rgb(var(--color-bg-hover) / <alpha-value>)',
        'border-default': 'rgb(var(--color-border-default) / <alpha-value>)',
        'accent': 'rgb(var(--color-accent) / <alpha-value>)',
        'accent-hover': 'rgb(var(--color-accent-hover) / <alpha-value>)',
        'accent-teal': 'rgb(var(--color-accent-teal) / <alpha-value>)',
        'accent-wine': 'rgb(var(--color-accent-wine) / <alpha-value>)',
        'text-primary': 'rgb(var(--color-text-primary) / <alpha-value>)',
        'text-secondary': 'rgb(var(--color-text-secondary) / <alpha-value>)',
        'text-muted': 'rgb(var(--color-text-muted) / <alpha-value>)',
        'success': 'rgb(var(--color-success) / <alpha-value>)',
        'error': 'rgb(var(--color-error) / <alpha-value>)',
        'warning': 'rgb(var(--color-warning) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['Cascadia Code', 'Fira Code', 'Consolas', 'monospace'],
      },
      fontSize: {
        // Bump default Tailwind sizes slightly for readability
        'xs': ['0.8125rem', { lineHeight: '1.125rem' }],   // 13px (was 12px)
        'sm': ['0.9375rem', { lineHeight: '1.375rem' }],   // 15px (was 14px)
      },
    },
  },
  plugins: [],
}

