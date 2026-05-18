/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/renderer/index.html',
    './src/renderer/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        unitep: {
          navy: '#003366',
          'navy-light': '#004C99',
          'navy-dark': '#002244',
          warning: '#FFC107',
          'warning-bg': '#FFF3CD',
          danger: '#DC3545',
          'danger-bg': '#F8D7DA',
          info: '#17A2B8',
          'info-bg': '#D1ECF1',
          step: '#FF6F00',
          'step-bg': '#FFF8E1',
          gray: '#F4F6F8',
          border: '#D5DBE3',
        },
        edf: {
          orange: '#FF6F00',
          blue: '#003366',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Arial', 'system-ui', 'sans-serif'],
        unitep: ['Arial', 'Helvetica', 'sans-serif'],
        mono: ['Courier New', 'monospace'],
      },
      fontSize: {
        'unitep-xs': ['8pt', '1.3'],
        'unitep-sm': ['9pt', '1.35'],
        'unitep-base': ['10pt', '1.4'],
        'unitep-h3': ['11pt', '1.3'],
        'unitep-h2': ['11pt', '1.3'],
        'unitep-h1': ['12pt', '1.3'],
      },
      boxShadow: {
        'unitep': '0 1px 3px rgba(0, 51, 102, 0.08), 0 1px 2px rgba(0, 51, 102, 0.06)',
        'unitep-lg': '0 4px 12px rgba(0, 51, 102, 0.12), 0 2px 4px rgba(0, 51, 102, 0.08)',
        'page': '0 0 0 1px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.12)',
      },
      spacing: {
        'a4-w': '210mm',
        'a4-h': '297mm',
      },
    },
  },
  plugins: [],
};
