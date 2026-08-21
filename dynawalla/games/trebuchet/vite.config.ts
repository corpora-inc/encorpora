import { defineConfig } from 'vite'

export default defineConfig({
  server: { port: 4173, strictPort: false },
  build: {
    target: 'es2022',
    lib: {
      entry: 'src/index.ts',
      name: 'DynawallaTrebuchet',
      formats: ['es'],
      fileName: 'trebuchet',
    },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
})
