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
          DEFAULT: '#6C5DD3',
          hover: '#5D5FEF',
          light: '#F0EFFF',
        },
        background: '#F8F9FB',
        card: '#FFFFFF',
        text: {
          primary: '#111827',
          secondary: '#6B7280',
        },
        success: '#10B981',
        danger: '#EF4444',
        warning: '#FBBF24',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '24px',
        'xl': '16px',
      },
      boxShadow: {
        'card': '0px 4px 20px rgba(0, 0, 0, 0.03)',
        'card-hover': '0px 8px 30px rgba(0, 0, 0, 0.06)',
      }
    },
  },
  plugins: [],
}
