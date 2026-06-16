import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F9F9F7", // newsprint off-white
        ink: "#111111", // ink black
        divider: "#E5E5E0",
        editorial: "#CC0000", // editorial red — semantic NEGATIVE: error, trigger, cancel, default  (~oklch 0.53 0.22 28)
        positive: "#15663F", // deep editorial green — semantic POSITIVE: fill, settled, earned, good standing  (~oklch 0.49 0.10 157)
      },
      fontFamily: {
        serif: ["'Playfair Display'", "'Times New Roman'", "serif"],
        body: ["'Lora'", "Georgia", "serif"],
        sans: ["'Inter'", "'Helvetica Neue'", "sans-serif"],
        mono: ["'JetBrains Mono'", "'Courier New'", "monospace"],
      },
      borderRadius: {
        none: "0px",
        DEFAULT: "0px",
        sm: "0px",
        md: "0px",
        lg: "0px",
        xl: "0px",
        full: "0px",
      },
      boxShadow: {
        hard: "4px 4px 0px 0px #111111",
        "hard-sm": "2px 2px 0px 0px #111111",
        "hard-red": "4px 4px 0px 0px #CC0000",
      },
      maxWidth: {
