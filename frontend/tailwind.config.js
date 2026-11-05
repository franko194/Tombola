/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  // On touch screens a tapped element keeps its hover style until another one is tapped. Apply hover only where it exists.
  future: { hoverOnlyWhenSupported: true },
  theme: {
    extend: {
      // Institutional blues for the events calendar. Replace these hex values with the official brand ones when available.
      colors: {
        inst: {
          navy: "#0A2F5C",
          navyPale: "#EAF0F8",
          blue: "#1A7FD4",
          bluePale: "#EAF2FB",
          blueBorder: "#9DC3EA",
          alert: "#D9263F",
          alertPale: "#FDEEF0",
          alertBorder: "#F3B6BF",
        },
      },
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
