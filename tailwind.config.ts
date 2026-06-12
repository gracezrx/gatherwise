import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#191917",
        moss: "#747b6f",
        sage: "#dedbd2",
        coral: "#ef9f86",
        flax: "#d8c3aa",
        mist: "#f0ede6",
        cloud: "#f8f5ee"
      },
      boxShadow: {
        button: "0 9px 0 rgba(25, 25, 23, 0.12)",
        lift: "0 24px 60px rgba(25, 25, 23, 0.13)",
        panel: "0 24px 80px rgba(25, 25, 23, 0.1)"
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(0.2, 0.8, 0.2, 1)"
      }
    }
  },
  plugins: []
};

export default config;
