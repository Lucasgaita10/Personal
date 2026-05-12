import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: '1.25rem', screens: { '2xl': '1400px' } },
    extend: {
      colors: {
        // Stone Gate institutional palette
        sg: {
          primary: '#780000',
          'primary-hover': '#5a0000',
          'primary-soft': '#fbeeee',
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
        primary: { DEFAULT: '#780000', foreground: '#ffffff' },
        secondary: { DEFAULT: '#fafafa', foreground: '#0a0a0a' },
        muted: { DEFAULT: '#f5f5f5', foreground: '#6b6b6b' },
        accent: { DEFAULT: '#fbeeee', foreground: '#780000' },
        destructive: { DEFAULT: '#b91c1c', foreground: '#ffffff' },
        border: '#e5e5e5',
        input: '#e5e5e5',
        ring: '#780000',
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
