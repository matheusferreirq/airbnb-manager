/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        accent: "#7C3AED",
        "accent-light": "#EDE9FE",
      },
    },
  },
  plugins: [],
}
