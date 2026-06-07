/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'Arial', 'sans-serif'],
      },
      colors: {
        jarvis: {
          panel: '#111827',
          surface: '#0f172a',
          border: '#243244',
          accent: '#7c3aed',
        },
      },
    },
  },
  plugins: [],
};
