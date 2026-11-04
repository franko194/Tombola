/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  // On touch screens a tapped element keeps its hover style until another one is tapped. Apply hover only where it exists.
  future: { hoverOnlyWhenSupported: true },
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "Segoe UI", "Arial", "sans-serif"],
      },
      boxShadow: {
        lab: "0 18px 48px rgba(15, 23, 42, 0.12)",
      },
    },
  },
  plugins: [],
};
