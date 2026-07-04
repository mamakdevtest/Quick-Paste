/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/**/*.html',
    './src/**/*.js',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        /* Dark mode palette */
        'd-bg':     '#121212',
        'd-card':   '#1a1b23',
        'd-hover':  '#252630',
        'd-input':  '#181920',
        'd-border': '#2f313d',
        'd-border2':'#4b4d5a',
        'd-text':   '#e2e2e4',
        'd-dim':    '#8b8d98',
        'd-primary':'#60a5fa',
        /* Light mode palette — Material You */
        'l-bg':     '#fdf7ff',
        'l-surface':'#fdf7ff',
        'l-card':   '#f2ecf4',
        'l-hover':  '#e6e0e9',
        'l-border': '#cbc4d2',
        'l-text':   '#1d1b20',
        'l-dim':    '#49454f',
        'l-primary':'#4f378a',
      }
    }
  },
  plugins: [],
};
