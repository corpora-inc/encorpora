import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// Release builds export BUILD_NUMBER; only a numeric value reaches problem reports.
const build = /^[0-9][0-9.]{0,31}$/.test(process.env.BUILD_NUMBER ?? '') ? process.env.BUILD_NUMBER : '';
export default defineConfig({ plugins: [react()], clearScreen: false, server: { port: 1420, strictPort: true }, envPrefix: ['VITE_', 'TAURI_ENV_'], define: { __AHA_BUILD__: JSON.stringify(build) }, build: { target: 'es2022' } });
