/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Accent oparty na CSS variable — czarny w jasnym, biały w ciemnym
        // Obsługuje modyfikatory opacity: bg-accent-500/20, border-accent-400/30 itp.
        accent: {
          50:  "rgb(var(--accent-rgb) / <alpha-value>)",
          100: "rgb(var(--accent-rgb) / <alpha-value>)",
          200: "rgb(var(--accent-rgb) / <alpha-value>)",
          300: "rgb(var(--accent-rgb) / <alpha-value>)",
          400: "rgb(var(--accent-rgb) / <alpha-value>)",
          500: "rgb(var(--accent-rgb) / <alpha-value>)",
          600: "rgb(var(--accent-rgb) / <alpha-value>)",
          700: "rgb(var(--accent-rgb) / <alpha-value>)",
          800: "rgb(var(--accent-rgb) / <alpha-value>)",
          900: "rgb(var(--accent-rgb) / <alpha-value>)",
        },
        // Pastelowe bloki kolorystyczne (Figma design)
        block: {
          lime:  "#dceeb1",
          lilac: "#c5b0f4",
          cream: "#f4ecd6",
          pink:  "#efd4d4",
          mint:  "#c8e6cd",
          coral: "#f3c9b6",
          navy:  "#1f1d3d",
        },
      },
      fontFamily: {
        sans:    ["Inter", "system-ui", "sans-serif"],
        mono:    ['"JetBrains Mono"', "Menlo", "monospace"],
        display: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
}
