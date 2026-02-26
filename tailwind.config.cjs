/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./entrypoints/**/*.{html,ts,tsx,js,jsx}",
    "./components/**/*.{ts,tsx,js,jsx}",
    "./ui/sidepanel/**/*.{ts,tsx,js,jsx}",
    "./public/**/*.{html}",
    "./assets/**/*.{css}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
