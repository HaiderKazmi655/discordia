/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "dc-bg-dark": "#202225",
        "dc-bg-secondary": "#2f3136",
        "dc-bg-primary": "#36393f",
        "dc-bg-modifier": "#40444b",
        "dc-text-normal": "#dcddde",
        "dc-text-muted": "#b9bbbe",
        "dc-brand": "#5865F2",
        "dc-green": "#3ba55c",
        "dc-red": "#ed4245",
      }
    },
  },
  plugins: [],
}
