import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          red: '#E32726',
          dark: '#0f0f0f',
          surface: '#1a1a1a',
          border: '#2a2a2a',
          muted: '#6b6b6b',
        }
      }
    },
  },
  plugins: [],
};
export default config;
