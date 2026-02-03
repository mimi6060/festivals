/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#6366F1',
          50: '#ECEEFF',
          100: '#D8DCFE',
          200: '#B2B9FD',
          300: '#8B95FC',
          400: '#6572FB',
          500: '#6366F1',
          600: '#3538CD',
          700: '#2A2D9F',
          800: '#1F2171',
          900: '#141643',
        },
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
      },
    },
  },
  plugins: [],
}
