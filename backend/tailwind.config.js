/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["../public/**/*.{html,js}"],
  theme: {
    extend: {
      colors: {
        gold: "#e9c176",
        "gold-deep": "#c5a059",
        ink: "#0a0a0a",
        surface: "#131313",
        panel: "#201f1f",
        line: "#4e4639",
        cream: "#e5e2e1",
        muted: "#d1c5b4",
      },
      fontFamily: {
        display: ["Playfair Display", "serif"],
        body: ["Montserrat", "sans-serif"],
      },
    },
  },
  plugins: [],
};
