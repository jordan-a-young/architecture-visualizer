import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('fullscreen resizes the real canvas, preserves selection and exports its resolution', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/interaction-test.html?legend');
  await expect(
    page.getByRole('button', { name: 'Download PNG', exact: true }),
  ).toBeEnabled();
  await page.locator('.av-node-label[data-node-id="a"]').click();
  const before = (await page.locator('canvas').boundingBox())!;
  await page
    .getByRole('button', { name: 'Enter fullscreen', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Exit fullscreen', exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.fullscreenElement?.classList.contains('av-viewer'),
      ),
    )
    .toBe(true);
  await expect
    .poll(async () => (await page.locator('canvas').boundingBox())!.height)
    .toBeGreaterThan(before.height);
  await expect(
    page.getByRole('heading', { name: 'Custom node', exact: true }),
  ).toBeVisible();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PNG', exact: true }).click();
  const download = await pending;
  await download.saveAs('artifacts/fullscreen-export.png');
  const png = await readFile((await download.path())!);
  const size = await page
    .locator('canvas')
    .evaluate((canvas: HTMLCanvasElement) => ({
      width: canvas.width,
      height: canvas.height,
    }));
  expect(png.readUInt32BE(16)).toBe(size.width);
  expect(png.readUInt32BE(20)).toBe(size.height);
  await page.screenshot({ path: 'artifacts/fullscreen-viewer.png' });
  // Browser-initiated exit uses the same fullscreenchange path as Escape/browser UI.
  await page.evaluate(() => document.exitFullscreen());
  await expect(
    page.getByRole('button', { name: 'Enter fullscreen', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Custom node', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Enter fullscreen', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Exit fullscreen', exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement === null))
    .toBe(true);
  expect(errors).toEqual([]);
});

test('WebGL1-only environments retain the inspector without mounting an unsupported renderer', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      ...args: Parameters<typeof original>
    ) {
      return String(args[0]) === 'webgl2' ? null : original.apply(this, args);
    } as typeof original;
  });
  await page.goto('/interaction-test.html');
  expect(
    await page.evaluate(
      () => !!document.createElement('canvas').getContext('webgl'),
    ),
  ).toBe(true);
  await expect(page.locator('.av-scene-fallback')).toContainText(
    'requires WebGL2',
  );
  await expect(page.locator('canvas')).toHaveCount(0);
  await page.getByText('Browse nodes (3)', { exact: true }).click();
  await page
    .locator('.av-node-list')
    .getByRole('button', { name: 'Custom node', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Custom node', exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
