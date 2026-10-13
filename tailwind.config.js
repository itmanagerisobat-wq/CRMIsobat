/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        forest: {
          DEFAULT: 'var(--color-accent)',
          dark: 'var(--color-accent-dark)',
          light: 'var(--color-accent-light)',
        },
        gold: {
          DEFAULT: '#C9A227',
          light: '#FFF2CC',
        },
        isored: '#C7070A',
        ink: '#1F2A24',
        statut: {
          nonhonore: '#2196F3',
          honore: '#00B050',
          reporte: '#8B2FE0',
          annule: '#E4032E',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'Segoe UI', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
