/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        arc: {
          blue: '#1B3158',
          accent: '#0B53BF',
          light: '#F4F7FC',
          border: '#E2E8F0',
          senior: '#059669',
          junior: '#D97706',
        }
      }
    },
  },
  plugins: [],
}
