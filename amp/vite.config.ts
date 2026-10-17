import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({plugins:[react()],server:{port:4310,proxy:{'/api':'http://127.0.0.1:4311'}},build:{outDir:'dist'}});
