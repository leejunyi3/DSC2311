import type { Config } from "tailwindcss";

/**
 * Control-tower dark theme (§14). Semantic colours are also encoded with icons
 * and shapes in the UI, never colour alone.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: {
          900: "#0a0f1a", // dark navy background
          800: "#0f1626",
          700: "#151f33", // cards
          600: "#1d2a44",
          500: "#2a3a5c",
        },
        status: {
          safe: "#10b981", // emerald
          warn: "#f59e0b", // amber
          high: "#ef4444", // red
          critical: "#dc2626",
          sim: "#a855f7", // purple (simulated)
          unavailable: "#6b7280", // grey
          live: "#22d3ee",
        },
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
