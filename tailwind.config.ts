import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        "ink-blue": "#0f172a",
        "ink-accent": "#14b8a6",
        "ink-warm": "#f97316"
      }
    }
  },
  plugins: []
};

export default config;
