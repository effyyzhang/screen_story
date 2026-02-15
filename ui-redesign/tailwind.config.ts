import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Eagle-inspired dark palette
        bg: {
          app: '#0D0D0D',
          surface: '#161616',
          hover: '#1C1C1C',
          sidebar: '#0A0A0A',
        },
        border: {
          subtle: '#1A1A1A',
          DEFAULT: '#262626',
          hover: '#404040',
        },
        text: {
          primary: '#E8E8E8',
          secondary: '#A0A0A0',
          tertiary: '#6B6B6B',
          disabled: '#404040',
        },
        accent: {
          DEFAULT: '#5E6AD2',
          hover: '#6E7AE2',
        },
        success: '#00D26A',
        warning: '#F59E0B',
        error: '#FF6B6B',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Display',
          'SF Pro Text',
          'system-ui',
          'sans-serif',
        ],
        mono: ['SF Mono', 'Monaco', 'Consolas', 'monospace'],
      },
      fontSize: {
        xs: ['11px', { lineHeight: '1.4', letterSpacing: '-0.01em' }],
        sm: ['12px', { lineHeight: '1.5', letterSpacing: '-0.01em' }],
        base: ['14px', { lineHeight: '1.5', letterSpacing: '-0.01em' }],
        lg: ['16px', { lineHeight: '1.5', letterSpacing: '-0.01em' }],
      },
      boxShadow: {
        sm: '0 2px 8px rgba(0, 0, 0, 0.3)',
        DEFAULT: '0 4px 16px rgba(0, 0, 0, 0.4)',
        lg: '0 8px 24px rgba(0, 0, 0, 0.5)',
      },
      transitionTimingFunction: {
        'eagle': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
}

export default config
