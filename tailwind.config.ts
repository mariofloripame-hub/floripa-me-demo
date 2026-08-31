import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        graphite: "#0B1416",
        "graphite-deep": "#123542",
        turquoise: "#00E6C8",
        blue: "#00A8E0",
        coral: "#FF7A59",
        alert: "#FF5A5A",
        ink: "#FFFFFF",
        "ink-dim": "rgba(255,255,255,0.6)",
      },
      fontFamily: {
        display: ["var(--font-syne)", "sans-serif"],
        body: ["var(--font-dm-sans)", "sans-serif"],
      },
      borderRadius: {
        card: "14px",
        pill: "20px",
      },
    },
  },
  plugins: [],
};

export default config;
