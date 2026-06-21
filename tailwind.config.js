/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ramen: {
          broth: '#f4c95d',
          soy: '#5b3a1f',
          chili: '#d2452f',
          noodle: '#fef6e4',
          nori: '#1f2a37',
        },
      },
      fontFamily: {
        display: ['"Noto Sans JP"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
