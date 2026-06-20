import type { Config } from "tailwindcss";

const c = (v: string) => `rgb(var(${v}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: c("--surface"),
          lowest: c("--surface-container-lowest"),
          low: c("--surface-container-low"),
          high: c("--surface-container-high"),
          highest: c("--surface-container-highest"),
          "container-lowest": c("--surface-container-lowest"),
          "container-low": c("--surface-container-low"),
          container: c("--surface-container"),
          "container-high": c("--surface-container-high"),
          "container-highest": c("--surface-container-highest"),
        },
        "on-surface": c("--on-surface"),
        "on-surface-variant": c("--on-surface-variant"),
        primary: {
          DEFAULT: c("--primary"),
          container: c("--primary-container"),
        },
        "on-primary": c("--on-primary"),
        secondary: c("--secondary"),
        "on-secondary": c("--on-secondary"),
        tertiary: c("--tertiary"),
        amber: c("--amber"),
        coral: c("--coral"),
        error: c("--error"),
        outline: {
          DEFAULT: c("--outline"),
          variant: c("--outline-variant"),
        },
      },
      fontFamily: {
        sans: ["var(--font-arabic)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        DEFAULT: "12px",
        card: "12px",
      },
      keyframes: {
        "fade-in": { "0%": { opacity: "0", transform: "translateY(4px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
      },
      animation: { "fade-in": "fade-in 0.25s ease-out" },
    },
  },
  plugins: [],
};
export default config;
