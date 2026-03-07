/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                slate: {
                    950: '#0F172A',
                },
                brand: {
                    bg: '#0d1117',        /* Main canvas background */
                    card: '#161b27',      /* Card/panel background */
                    sidebar: '#0f1520',   /* Sidebar background */
                    accent: '#00e5ff',    /* Primary accent (cyan) */
                    red: '#ff4d6d',       /* Alert/critical color */
                    purple: '#a855f7',    /* Secondary accent */
                    orange: '#f97316',    /* Warning color */
                    text: '#ffffff',      /* Text primary */
                    muted: '#8892a4',     /* Text secondary */
                    border: 'rgba(255,255,255,0.06)' /* Card border */
                }
            },
            fontFamily: {
                system: ['Inter', 'system-ui', 'sans-serif'],
            },
            borderRadius: {
                'ek': '14px',
            },
            animation: {
                'spin-slow': 'spin 3s linear infinite',
                'fadeIn': 'fadeIn 0.4s ease-out',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0', transform: 'translateY(8px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
            },
        },
    },
    plugins: [],
}
