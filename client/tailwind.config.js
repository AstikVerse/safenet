/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#F43F5E", // Rose/Pink
          hover: "#E11D48",
          light: "#FFF1F2"
        },
        secondary: {
          DEFAULT: "#8B5CF6", // Soft violet
          hover: "#7C3AED",
          light: "#F5F3FF"
        },
        accent: {
          DEFAULT: "#14B8A6", // Warm Teal
          hover: "#0D9488",
          light: "#F0FDFA"
        },
        background: {
          white: "#FFFFFF",
          warm: "#FFF7F7"
        },
        border: {
          soft: "#F1D5D8"
        },
        dark: {
          heading: "#1A1A2E",
          body: "#4A4A6A",
          muted: "#8888A8"
        }
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"]
      },
      boxShadow: {
        soft: "0 4px 20px -2px rgba(244, 63, 94, 0.08)",
        card: "0 2px 12px -1px rgba(241, 213, 216, 0.4)",
        panic: "0 0 0 0 rgba(244, 63, 94, 0.4)",
        safe: "0 4px 14px rgba(20, 184, 166, 0.35)"
      },
      animation: {
        'pulse-ring': 'pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in-up': 'fade-in-up 0.15s ease-out forwards',
        'scale-bounce': 'scale-bounce 0.3s ease-out',
        'vibrate': 'vibrate 0.2s linear infinite'
      },
      keyframes: {
        'pulse-ring': {
          '0%': { boxShadow: '0 0 0 0 rgba(244, 63, 94, 0.6)' },
          '70%': { boxShadow: '0 0 0 16px rgba(244, 63, 94, 0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(244, 63, 94, 0)' }
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        'scale-bounce': {
          '0%, 100%': { transform: 'scale(1)' },
          '30%': { transform: 'scale(0.93)' },
          '70%': { transform: 'scale(1.05)' }
        },
        'vibrate': {
          '0%, 100%': { transform: 'translate(0, 0) rotate(0deg)' },
          '20%': { transform: 'translate(-2px, 1px) rotate(-0.5deg)' },
          '40%': { transform: 'translate(1px, -1px) rotate(0.5deg)' },
          '60%': { transform: 'translate(-1px, -1px) rotate(-0.5deg)' },
          '80%': { transform: 'translate(2px, 2px) rotate(0.5deg)' }
        }
      }
    },
  },
  plugins: [],
}
