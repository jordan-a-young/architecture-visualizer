import { defineConfig } from 'vite-plus';
export default defineConfig({
  base: './',
  build: { target: ['chrome107', 'edge107', 'firefox104', 'safari16'] },
});
