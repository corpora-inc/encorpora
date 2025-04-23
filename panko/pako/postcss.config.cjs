// postcss.config.cjs
module.exports = {
    plugins: {
        // ← this is the new name!
        '@tailwindcss/postcss': {},
        autoprefixer: {},
    },
}
