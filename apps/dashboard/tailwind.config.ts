import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f6f7f9",
          100: "#eceef2",
          200: "#d5dae3",
          300: "#b0b9c9",
          400: "#8592a9",
          500: "#66748f",
          600: "#515d75",
          700: "#434c5f",
          800: "#3a4151",
          900: "#333844",
          950: "#22252d",
        },
        accent: {
          DEFAULT: "#0f766e",
          soft: "#ccfbf1",
          strong: "#0d9488",
        },
      },
      fontFamily: {
        sans: ["IBM Plex Sans", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
