/** @type {import('tailwindcss').Config} */
module.exports = {
    safelist: [
        'text-small',
        'text-medium',
        'text-large',
        'text-extra-large',
    ],
    theme: {
        extend: {
            keyframes: {
                breathe: {
                    '0%, 100%': {
                        transform: 'scale(1)',
                        opacity: '1',
                        boxShadow: '0 10px 15px -3px rgba(168, 85, 247, 0.4), 0 4px 6px -4px rgba(168, 85, 247, 0.4)'
                    },
                    '50%': {
                        transform: 'scale(1.05)',
                        opacity: '0.95',
                        boxShadow: '0 10px 15px -3px rgba(168, 85, 247, 0.6), 0 4px 6px -4px rgba(168, 85, 247, 0.6)'
                    },
                },
            },
            animation: {
                breathe: 'breathe 2s ease-in-out infinite',
            },
        },
    },
    plugins: [
        // e.g. require('@tailwindcss/forms')
    ],
}
