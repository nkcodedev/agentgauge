import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "var(--bg)",
        surface: "var(--surface)",
        muted: "var(--surface-muted)",
        line: "var(--border)",
        fg: "var(--text)",
        secondary: "var(--text-secondary)",
        faint: "var(--text-muted)",
        ink: {
          50: "var(--bg)",
          100: "var(--surface-muted)",
          200: "var(--border)",
          300: "var(--border)",
          400: "var(--text-muted)",
          500: "var(--text-muted)",
          600: "var(--text-secondary)",
          700: "var(--text-secondary)",
          800: "var(--text)",
          900: "var(--text)",
          950: "var(--text)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          soft: "var(--accent-soft)",
          strong: "var(--accent)",
        },
        ok: { DEFAULT: "var(--success)", soft: "var(--success-soft)" },
        warn: { DEFAULT: "var(--warning)", soft: "var(--warning-soft)" },
        bad: { DEFAULT: "var(--danger)", soft: "var(--danger-soft)" },
        info: { DEFAULT: "var(--info)", soft: "var(--info-soft)" },
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
      fontSize: {
        "2xs": ["12px", "16px"],
        xs: ["13px", "18px"],
        sm: ["14px", "20px"],
        base: ["16px", "24px"],
        title: ["20px", "28px"],
        kpi: ["28px", "32px"],
      },
      borderRadius: {
        control: "8px",
        panel: "12px",
      },
      boxShadow: {
        overlay: "var(--shadow-overlay)",
      },
    },
  },
  plugins: [],
};

export default config;
