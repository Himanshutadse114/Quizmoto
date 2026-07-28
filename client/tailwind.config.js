/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        quizmoto: {
          red: '#eb1736',
          blue: '#1368ce',
          yellow: '#ffa602',
          green: '#26890c',
          purple: '#46178f',
          lightPurple: '#864cbf',
          darkPurple: '#25076b',
        }
      },
      animation: {
        'bounce-slow': 'bounce 3s infinite',
      }
    },
  },
  plugins: [],
}
