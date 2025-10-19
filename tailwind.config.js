import forms from '@tailwindcss/forms';

export default {
  content: [
    './sidepanel/src/**/*.{js,jsx}',
    './common/**/*.js',
  ],
  theme: {
    extend: {
      boxShadow: {
        brand: '0 12px 24px rgba(15, 23, 42, 0.08)',
      },
      colors: {
        brand: {
          start: '#6366f1',
          end: '#3b82f6',
        },
      },
    },
  },
  plugins: [forms],
};
