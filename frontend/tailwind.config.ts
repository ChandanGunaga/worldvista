import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        navy: { 50: "#EEF1F8", 100: "#D5DCEE", 200: "#A9B6DA", 600: "#24387A", 700: "#1A2D66", 800: "#132457", 900: "#0E1F4D", 950: "#081536" },
        gold: { 50: "#FDF8E7", 100: "#FAEDC2", 300: "#F2D266", 400: "#F5C518", 500: "#E0B11E", 600: "#C9A227", 700: "#9E7D16" },
        cream: "#FAF8F3",
        ink: "#0F172A",
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: { card: "0 1px 2px rgba(15,23,42,.04), 0 8px 24px rgba(15,23,42,.06)" },
    },
  },
  plugins: [],
};
export default config;
