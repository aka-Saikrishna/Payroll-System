import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#f0f4f8",
          100: "#d9e2ec",
          200: "#bcccdc",
          300: "#9fb3c8",
          400: "#6b8299",
          500: "#4a6178",
          600: "#334e68",
          700: "#243b53",
          800: "#102a43",
          900: "#0a1929",
        },
        surface: "#f7f8fa",
        success: {
          50: "#f0faf4",
          500: "#2e9e5b",
          700: "#1e6f3f",
        },
        warning: {
          50: "#fdf7ed",
          500: "#c98a1f",
          700: "#8f6114",
        },
        danger: {
          50: "#fdf1f1",
          500: "#c9403a",
          700: "#932e29",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      borderRadius: {
        DEFAULT: "6px",
      },
    },
  },
  plugins: [],
};

export default config;
