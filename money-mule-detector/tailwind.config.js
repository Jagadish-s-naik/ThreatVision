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
                    bg: '#171821',      // Dashboard deep dark background
                    card: '#21222D',    // Dashboard card background
                    border: '#3A3C4A',  // Subtle borders
                    accent: '#06B6D4',  // Cyan highlighting
                    purple: '#A855F7',  // Purple highlighting
                    red: '#EF4444',     // Red alerts
                    text: '#F1F5F9',    // Core text
                    muted: '#8B8D97',   // Muted text
                }
            },
            fontFamily: {
                syne: ['Syne', 'sans-serif'],
                mono: ['IBM Plex Mono', 'monospace'],
                sans: ['Inter', 'sans-serif'],
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
