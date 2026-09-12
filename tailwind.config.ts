import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        coral: "#ff6b5b",
        "coral-dark": "#e8543f",
        navy: "#1f2430",
        "navy-soft": "#4a5064",
        cream: "#fff8f0",
        "cream-dark": "#fbeee1",
        border: "#ece1d6",
      },
      fontFamily: {
        heading: ["var(--font-poppins)", "sans-serif"],
        body: ["var(--font-inter)", "sans-serif"],
      },
      borderRadius: {
        card: "16px",
      },
      boxShadow: {
        card: "0 12px 30px rgba(31, 36, 48, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
