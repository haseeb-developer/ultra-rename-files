/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      animation: {
        "bounce-slow": "bounce 3s linear infinite",
      },
      colors: {
        primary: "#3B82F6",
        secondary: "#10B981",
      },
    },
  },
  plugins: [],
};
