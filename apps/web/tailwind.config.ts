import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: '1.25rem', screens: { '2xl': '1400px' } },
    extend: {
      colors: {
        // Stonegate Capital institutional palette — black wordmark + warm gold.
        sg: {
          primary: '#a88b47',
          'primary-hover': '#8b7339',
          'primary-soft': '#f7f1dd',
          bg: '#ffffff',
          surface: '#fafafa',
          border: '#e5e5e5',
          text: '#0a0a0a',
          muted: '#6b6b6b',
          'muted-light': '#a3a3a3',
        },
        background: 'hsl(0 0% 100%)',
        foreground: 'hsl(0 0% 4%)',
        card: 'hsl(0 0% 100%)',
        'card-foreground': 'hsl(0 0% 4%)',
        primary: { DEFAULT: '#a88b47', foreground: '#ffffff' },
        secondary: { DEFAULT: '#fafafa', foreground: '#0a0a0a' },
        muted: { DEFAULT: '#f5f5f5', foreground: '#6b6b6b' },
        accent: { DEFAULT: '#f7f1dd', foreground: '#8b7339' },
        destructive: { DEFAULT: '#b91c1c', foreground: '#ffffff' },
        border: '#e5e5e5',
        input: '#e5e5e5',
        ring: '#a88b47',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['"Source Serif 4"', 'serif'],
      },
      borderRadius: { lg: '6px', md: '4px', sm: '2px' },
      letterSpacing: { tighter: '-0.02em', tight: '-0.01em' },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
export default config;
