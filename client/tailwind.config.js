/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/app/**/*.{js,jsx,ts,tsx}", "./src/components/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--color-bg)",
        surface: "var(--color-surface)",
        highlight: "var(--color-highlight-bg)",
        textPrimary: "var(--color-text-primary)",
        textSecondary: "var(--color-text-secondary)",
        border: "var(--color-border)",
        primary: "var(--color-primary)",
        "primary-hover": "var(--color-primary-hover)",
        secondary: "var(--color-secondary)",
        success: "var(--color-success)",
        error: "var(--color-error)"
      },
      boxShadow: {
        elevated: "var(--shadow-elevated)",
        soft: "var(--shadow-soft)"
      },
      borderRadius: { "2xl": "16px" }
    }
  },
  plugins: []
};
