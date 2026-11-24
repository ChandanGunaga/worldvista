import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        navy: { 50: "#EEF1F8", 100: "#D5DCEE", 200: "#A9B6DA", 600: "#24387A", 700: "#1A2D66", 800: "#132457", 900: "#0E1F4D", 950: "#081536" },
        gold: { 50: "#FDF8E7", 100: "#FAEDC2", 200: "#F7E3A1", 300: "#F2D266", 400: "#F5C518", 500: "#E0B11E", 600: "#C9A227", 700: "#9E7D16" },
        cream: "#FAF8F3",
        onyx: { 950: "#060607", 900: "#0B0B0D", 850: "#101013", 800: "#151518", 700: "#1C1C21", 600: "#26262C" },
        champagne: "#F3E6C4",
        ink: "#0F172A",
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,23,42,.04), 0 8px 24px rgba(15,23,42,.06)",
        glow: "0 0 0 1px rgba(226,176,74,.35), 0 18px 60px -12px rgba(226,176,74,.35)",
      },
      keyframes: {
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-14px)" } },
        shimmer: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
        marquee: { "0%": { transform: "translateX(0)" }, "100%": { transform: "translateX(-50%)" } },
        kenburns: { "0%": { transform: "scale(1)" }, "100%": { transform: "scale(1.12)" } },
        twinkle: { "0%,100%": { opacity: "0.15" }, "50%": { opacity: "0.9" } },
        "spin-slow": { to: { transform: "rotate(360deg)" } },
        rise: { "0%": { opacity: "0", transform: "translateY(24px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        shimmer: "shimmer 6s linear infinite",
        marquee: "marquee 40s linear infinite",
        kenburns: "kenburns 24s ease-out infinite alternate",
        twinkle: "twinkle 3.5s ease-in-out infinite",
        "spin-slow": "spin-slow 28s linear infinite",
        rise: "rise .9s cubic-bezier(.2,.7,.2,1) both",
      },
    },
  },
  plugins: [],
};
export default config;
