tailwind.config = {
  theme: {
    extend: {
      fontFamily: {
        display: ['"Playfair Display"', "serif"],
        body: ["Outfit", "sans-serif"],
      },
      colors: {
        wine: {
          DEFAULT: "#7b2d42",
          light: "#f5e8ec",
          mid: "#a84d6a",
          readable: "#be6783",
        },
        dark: "#1a0d11",
        muted: "#7c6b70",
      },
      borderRadius: {
        card: "20px",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulse2: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.3" },
        },
      },
      animation: {
        "fade-up": "fadeUp 0.35s ease both",
        "fade-up-1": "fadeUp 0.4s 0.05s ease both",
        "fade-up-2": "fadeUp 0.4s 0.10s ease both",
        "fade-up-3": "fadeUp 0.4s 0.15s ease both",
        "fade-up-4": "fadeUp 0.4s 0.20s ease both",
        "fade-up-5": "fadeUp 0.4s 0.25s ease both",
        pulse2: "pulse2 2s infinite",
      },
    },
  },
};
