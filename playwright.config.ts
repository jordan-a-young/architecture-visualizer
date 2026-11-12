import { defineConfig } from '@playwright/test';
const port = Number(process.env.ARCHVIZ_PORT ?? 5173);
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: './tests',
  timeout: 45_000,
  workers: 1,
  use: {
    baseURL,
    viewport: { width: 1440, height: 1000 },
    launchOptions: {
      executablePath: process.env.ARCHVIZ_CHROMIUM_PATH,
      args: [
        '--no-sandbox',
        '--in-process-gpu',
        '--ignore-gpu-blocklist',
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
      ],
    },
  },
  webServer: {
    command: `pnpm --filter archgraph-core build && pnpm --filter archgraph-react build && pnpm --filter archgraph-demo dev --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
