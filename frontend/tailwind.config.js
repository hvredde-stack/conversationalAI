/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        display: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        // Navy — primary brand
        navy: {
          50: "#f4f6f8",
          100: "#e4e8ee",
          200: "#c4ccd8",
          300: "#9caab9",
          400: "#5f7287",
          500: "#384a61",
          600: "#1B263B",
          700: "#142033",
          800: "#0D1B2A",
          900: "#08111c",
        },
        // Gold — accent
        gold: {
          50: "#fbf6e5",
          100: "#f4e6a8",
          200: "#ead37d",
          300: "#e0c659",
          400: "#D4AF37",
          500: "#b69128",
          600: "#917220",
        },
        // Sky — secondary highlight
        sky: {
          400: "#4FC3F7",
          500: "#29B6F6",
        },
        // Alias 'brand' to navy so existing utilities keep working
        brand: {
          50: "#f4f6f8",
          100: "#e4e8ee",
          200: "#c4ccd8",
          300: "#9caab9",
          400: "#5f7287",
          500: "#384a61",
          600: "#1B263B",
          700: "#142033",
          800: "#0D1B2A",
          900: "#08111c",
          950: "#040810",
        },
      },
      boxShadow: {
        soft: "0 1px 2px 0 rgb(13 27 42 / 0.05), 0 4px 16px -2px rgb(13 27 42 / 0.08)",
        card: "0 1px 3px 0 rgb(13 27 42 / 0.07), 0 12px 40px -10px rgb(13 27 42 / 0.18)",
        focus: "0 0 0 4px rgb(212 175 55 / 0.22)",
        gold: "0 0 0 3px rgb(212 175 55 / 0.20)",
      },
      animation: {
        "fade-in": "fadeIn 0.25s ease-out",
        "slide-up": "slideUp 0.30s ease-out",
        "bounce-dot": "bounceDot 1.2s infinite ease-in-out",
        "glow": "glow 2.4s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        bounceDot: {
          "0%, 80%, 100%": { transform: "scale(0.6)", opacity: "0.4" },
          "40%": { transform: "scale(1)", opacity: "1" },
        },
        glow: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgb(79 195 247 / 0.45)" },
          "50%": { boxShadow: "0 0 0 6px rgb(79 195 247 / 0)" },
        },
      },
    },
  },
  plugins: [],
};
