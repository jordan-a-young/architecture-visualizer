import { defineConfig } from 'vite-plus';
export default defineConfig({
  build: {
    target: ['chrome107', 'edge107', 'firefox104', 'safari16'],
    lib: {
      entry: { index: 'src/index.ts', elk: 'src/elk.ts' },
      formats: ['es'],
      fileName: (_format, entryName) => `${entryName}.js`,
      cssFileName: 'styles',
    },
    sourcemap: true,
    rolldownOptions: {
      external: (id) => !id.startsWith('.') && !id.startsWith('/'),
    },
  },
});
