/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './renderer/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#090d16',
        card: '#0f172a',
        border: '#1e293b',
        primary: {
          DEFAULT: '#3b82f6',
          hover: '#2563eb',
        },
        gold: '#eab308',
      },
    },
  },
  plugins: [],
};
