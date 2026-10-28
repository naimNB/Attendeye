export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0f172a', // slate-900
          dark: '#0a0f1d',
          sidebar: '#0f172a',
          surface: '#1e293b', // slate-800
          border: '#334155',  // slate-700
        },
        teal: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
          950: '#042f2e',
        },
        // Alias pine to primary dark teal for legacy component compatibility
        pine: {
          DEFAULT: '#0f766e',
          dark: '#115e59',
          light: '#14b8a6',
        },
        mint: '#ccfbf1',
        paper: '#f8fafc', // light slate
      }
    }
  },
  plugins: []
};
