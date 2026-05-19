import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#1A5276",
          50: "#EAF4FB",
          100: "#D6EAF8",
          200: "#AED6F1",
          500: "#2E86C1",
          600: "#1A5276",
          700: "#154360",
        },
        accent: {
          DEFAULT: "#F39C12",
          100: "#FCF3CF",
          500: "#F39C12",
        },
        success: "#27AE60",
        danger: "#E74C3C",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}

export default config
