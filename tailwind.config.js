/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: "#F59E0B",
          dark: "#F97316",
          light: "#FFF3D6",
        },
        ink: {
          DEFAULT: "#0F1419",
          mid: "#536471",
          faint: "#8B99A8",
        },
        line: "#E8ECF1",
        surface: "#F6F8FB",
        up: "#00C48C",
        "up-bg": "#E6F9F1",
        down: "#FF4757",
        "down-bg": "#FFF0F0",
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.25rem",
      },
      boxShadow: {
        card: "0 1px 3px rgba(16,20,32,.08), 0 8px 24px -12px rgba(16,20,32,.12)",
        pop: "0 24px 48px -20px rgba(245,158,11,.35)",
      },
    },
  },
  plugins: [],
};
