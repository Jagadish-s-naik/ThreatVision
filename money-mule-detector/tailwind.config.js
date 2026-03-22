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
                "tertiary": "#ff716a",
                "inverse-primary": "#00687b",
                "on-secondary-container": "#d9c8ff",
                "outline-variant": "#40485d",
                "surface": "#060e20",
                "on-tertiary-fixed-variant": "#79000e",
                "primary-fixed-dim": "#40ceed",
                "secondary": "#ac8aff",
                "surface-variant": "#192540",
                "error": "#ff716c",
                "primary-container": "#21bedc",
                "background": "#060e20",
                "tertiary-container": "#fd4e4d",
                "on-primary-fixed-variant": "#005564",
                "primary": "#53ddfc",
                "error-container": "#9f0519",
                "on-secondary-fixed-variant": "#5f28c8",
                "on-error-container": "#ffa8a3",
                "secondary-dim": "#8455ef",
                "surface-container-lowest": "#000000",
                "secondary-container": "#5516be",
                "tertiary-fixed": "#ff928b",
                "on-primary-container": "#00343e",
                "error-dim": "#d7383b",
                "surface-dim": "#060e20",
                "on-secondary-fixed": "#40009b",
                "surface-bright": "#1f2b49",
                "on-surface-variant": "#a3aac4",
                "secondary-fixed-dim": "#ceb9ff",
                "on-surface": "#dee5ff",
                "primary-dim": "#40ceed",
                "outline": "#6d758c",
                "on-tertiary": "#490005",
                "tertiary-dim": "#ff716a",
                "on-error": "#490006",
                "on-tertiary-fixed": "#3a0003",
                "inverse-surface": "#faf8ff",
                "secondary-fixed": "#dac9ff",
                "surface-container-high": "#141f38",
                "on-secondary": "#280067",
                "on-background": "#dee5ff",
                "surface-tint": "#53ddfc",
                "primary-fixed": "#53ddfc",
                "inverse-on-surface": "#4d556b",
                "tertiary-fixed-dim": "#ff7b74",
                "surface-container-low": "#091328",
                "surface-container-highest": "#192540",
                "on-primary-fixed": "#003640",
                "surface-container": "#0f1930",
                "on-primary": "#004b58",
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
                headline: ['Space Grotesk', 'sans-serif'],
                body: ['Inter', 'sans-serif'],
                label: ['Inter', 'sans-serif']
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
