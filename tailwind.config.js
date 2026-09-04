/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Product Sans', 'Google Sans', 'Google Sans Text',
          'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI',
          'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif',
        ],
      },
      colors: {
        primary: 'var(--color-primary)',
        surface: 'var(--color-surface)',
        'surface-hover': 'var(--color-surface-hover)',
        accent: 'var(--color-accent)',
        mainText: 'var(--color-text-main)',
        mutedText: 'var(--color-text-muted)',
        borderColor: 'var(--color-border)',
        danger: '#ef4444',
        success: '#10b981',
      },
    },
  },
  plugins: [],
};
