import { defineConfig } from 'vite'

export default defineConfig({
  server: { port: 5191, strictPort: false },
  build: {
    target: 'es2022',
    lib: {
      entry: 'src/index.ts',
      name: 'DynawallaMergeIdle',
      formats: ['es'],
      fileName: 'merge-idle',
    },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
})
