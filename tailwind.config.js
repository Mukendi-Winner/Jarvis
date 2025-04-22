// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      backgroundImage: {
        'futuristic': `
          radial-gradient(circle at center, #0f172a 0%, #020617 100%),
          linear-gradient(to bottom, rgba(255,255,255,0.02) 0%, rgba(0,0,0,0) 100%)
        `,
        'futuristic-pattern': `
          radial-gradient(circle at center, #0f172a 0%, #020617 100%),
          linear-gradient(45deg, rgba(99, 102, 241, 0.05) 0%, transparent 100%),
          url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h60v60H0z' fill='none'/%3E%3Cpath d='M30 10c0-5.5 4.5-10 10-10h10v60H40c-5.5 0-10-4.5-10-10V10z' fill='%236d28d9' opacity='0.05'/%3E%3C/svg%3E")
        `
      },
      backgroundBlendMode: {
        'overlay': 'overlay',
      }
    },
  },
  plugins: [],
}