import { defineConfig } from 'vite';
export default defineConfig({
  build: {
    lib: {
      entry: { index: 'src/index.ts', elk: 'src/elk.ts' },
      formats: ['es'],
      fileName: (_format, entryName) => `${entryName}.js`,
      cssFileName: 'styles',
    },
    sourcemap: true,
    rollupOptions: {
      external: (id) => !id.startsWith('.') && !id.startsWith('/'),
    },
  },
});
