import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        cream: {
          50: '#FFFDF0',
          100: '#FFF8E7',
          200: '#F5EDD8',
          300: '#E8D5B7',
        },
        brown: {
          50: '#FDF6EE',
          100: '#F5E6D3',
          200: '#E8C9A0',
          300: '#C8956C',
          400: '#A0714A',
          500: '#7B5230',
          600: '#5C3A1E',
          700: '#3D2510',
          800: '#2C1810',
          900: '#1A0E08',
        },
        matcha: {
          500: '#6B8E4E',
          600: '#4E6E35',
        },
      },
      fontFamily: {
        sans: [
          '"Noto Sans JP"',
          '"Hiragino Kaku Gothic ProN"',
          '"Hiragino Sans"',
          'Meiryo',
          'sans-serif',
        ],
        serif: [
          '"Noto Serif JP"',
          '"Hiragino Mincho ProN"',
          'serif',
        ],
      },
      fontSize: {
        'base': ['16px', '1.7'],
        'lg': ['18px', '1.7'],
        'xl': ['20px', '1.6'],
        '2xl': ['24px', '1.5'],
        '3xl': ['30px', '1.4'],
      },
    },
  },
  plugins: [],
}

export default config
