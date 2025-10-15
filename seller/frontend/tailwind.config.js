export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      animation: {
        pop: 'pop 1s infinite',
        float: 'float 6s ease-in-out infinite',
      },
      keyframes: {
        pop: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
      },
      colors: {
        primary: {
          50: '#f44336',
          100: '#efbcb8',
          200: '#f0cfcc',
          300: '#fa4f43',
          400: '#f42c1e',
          500: '#f44336',
          600: '#cc0000',
          700: '#a90808',
          800: '#99190f',
          900: '#8c0f0f',
          950: '#422006',
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms') // optional but recommended for form styles
  ],
};
