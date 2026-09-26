import { expect, test } from '@playwright/test';
import type { Page, Locator } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function download(page: Page, button: Locator, path: string) {
  const pending = page.waitForEvent('download');
  await button.click();
  const result = await pending;
  await result.saveAs(path);
  const bytes = await readFile(path);
  expect(bytes.subarray(1, 4).toString()).toBe('PNG');
  return bytes.toString('base64');
}

test('PNG captures the current camera, WebGL, built-in labels and custom meshes', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith('http://127.0.0.1'))
      requests.push(request.url());
  });
  await page.goto('/interaction-test.html');
  const button = page.getByRole('button', { name: 'Download PNG' });
  await expect(button).toBeEnabled();
  await page.locator('[data-node-id="a"]').click();
  // Orbit, pan and zoom before capture. Labels should track the resulting view.
  const canvas = page.locator('canvas');
  const bounds = (await canvas.boundingBox())!;
  await page.mouse.move(bounds.x + 50, bounds.y + bounds.height - 100);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 110, bounds.y + bounds.height - 125, {
    steps: 8,
  });
  await page.mouse.up();
  await page.mouse.wheel(0, -70);
  // Wait for damping to finish by observing projected label positions, not a fixed sleep.
  await expect(async () => {
    const before = await page.locator('[data-node-id="a"]').boundingBox();
    await page.waitForTimeout(150);
    const after = await page.locator('[data-node-id="a"]').boundingBox();
    expect(
      Math.abs(after!.x - before!.x) + Math.abs(after!.y - before!.y),
    ).toBeLessThan(0.1);
  }).toPass();
  const initialPositions = await page
    .locator('[data-av-export-label]')
    .evaluateAll((labels) =>
      labels.map((label) => ({
        text: label.textContent,
        rect: label.getBoundingClientRect().toJSON(),
      })),
    );
  const labeled = await download(
    page,
    button,
    'artifacts/screenshot-export.png',
  );
  const bare = await download(
    page,
    page.getByRole('button', { name: 'Export without labels' }),
    'artifacts/screenshot-scene.png',
  );
  // Element screenshots include overlapping DOM. Hide labels and viewer chrome
  // while capturing the independent WebGL reference, then restore them.
  const hideOverlays = await page.addStyleTag({
    content:
      '.av-viewport > :not(:has(canvas)):not(canvas), .av-viewport [data-av-export-label] { visibility: hidden !important; }',
  });
  const canvasReference = (await canvas.screenshot()).toString('base64');
  await hideOverlays.evaluate((style) => style.parentNode?.removeChild(style));
  const report = await page.evaluate(
    async ({ labeled, bare, canvasReference }) => {
      const read = async (base64: string) => {
        const image = new Image();
        image.src = `data:image/png;base64,${base64}`;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext('2d')!;
        context.drawImage(image, 0, 0);
        return {
          width: image.width,
          height: image.height,
          data: context.getImageData(0, 0, image.width, image.height).data,
        };
      };
      const [full, plain, reference] = await Promise.all([
        read(labeled),
        read(bare),
        read(canvasReference),
      ]);
      const source = document.querySelector('canvas')!;
      const rect = source.getBoundingClientRect();
      const regions = [
        ...document.querySelectorAll('[data-av-export-label]'),
      ].map((label) => {
        const box = label.getBoundingClientRect();
        let changed = 0;
        for (
          let y = Math.max(0, Math.ceil(box.top - rect.top));
          y < Math.min(full.height, box.bottom - rect.top);
          y++
        ) {
          for (
            let x = Math.max(0, Math.ceil(box.left - rect.left));
            x < Math.min(full.width, box.right - rect.left);
            x++
          ) {
            const index = (y * full.width + x) * 4;
            if (
              Math.abs(full.data[index]! - plain.data[index]!) +
                Math.abs(full.data[index + 1]! - plain.data[index + 1]!) >
              10
            )
              changed++;
          }
        }
        return { text: label.textContent, changed };
      });
      let difference = 0;
      for (let i = 0; i < plain.data.length; i++)
        difference += Math.abs(plain.data[i]! - reference.data[i]!);
      return {
        width: full.width,
        height: full.height,
        expectedWidth: source.width,
        expectedHeight: source.height,
        meanDifference: difference / plain.data.length,
        regions,
      };
    },
    { labeled, bare, canvasReference },
  );
  expect(report.width).toBe(report.expectedWidth);
  expect(report.height).toBe(report.expectedHeight);
  expect(report.meanDifference).toBeLessThan(1);
  expect(report.regions.length).toBe(4);
  for (const region of report.regions)
    expect(region.changed, region.text ?? '').toBeGreaterThan(20);
  const afterPositions = await page
    .locator('[data-av-export-label]')
    .evaluateAll((labels) =>
      labels.map((label) => ({
        text: label.textContent,
        rect: label.getBoundingClientRect().toJSON(),
      })),
    );
  expect(afterPositions.map((label) => label.text)).toEqual(
    initialPositions.map((label) => label.text),
  );
  afterPositions.forEach((label, index) => {
    // OrbitControls may finish subpixel damping between captures.
    expect(
      Math.abs(label.rect.x - initialPositions[index]!.rect.x),
    ).toBeLessThan(0.5);
    expect(
      Math.abs(label.rect.y - initialPositions[index]!.rect.y),
    ).toBeLessThan(0.5);
  });
  await page.getByRole('button', { name: 'Toggle filter' }).click();
  await expect(page.locator('[data-node-id]')).toHaveCount(2);
  await download(page, button, 'artifacts/screenshot-filtered.png');
  expect(requests).toEqual([]);
});

test('screenshot fails clearly without WebGL', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      ...args: Parameters<typeof original>
    ) {
      return String(args[0]).startsWith('webgl')
        ? null
        : original.apply(this, args);
    } as typeof original;
  });
  await page.goto('/interaction-test.html');
  await expect(
    page.getByRole('button', { name: 'Download PNG' }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Export without labels' }).click();
  await expect(page.getByLabel('Export error')).toContainText('not ready');
});

test('PNG encoder failure is visible and export can be retried', async ({
  page,
}) => {
  await page.goto('/interaction-test.html');
  const button = page.getByRole('button', { name: 'Download PNG' });
  await expect(button).toBeEnabled();
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback) {
      HTMLCanvasElement.prototype.toBlob = original;
      callback(null);
    };
  });
  await button.click();
  await expect(page.getByRole('alert')).toContainText('Could not encode');
  await expect(button).toBeEnabled();
  await download(page, button, 'artifacts/screenshot-retry.png');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('mobile high-DPI PNG uses canvas resolution', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:5173/interaction-test.html');
  const button = page.getByRole('button', { name: 'Download PNG' });
  await expect(button).toBeEnabled();
  const encoded = await download(
    page,
    button,
    'artifacts/screenshot-mobile.png',
  );
  const png = Buffer.from(encoded, 'base64');
  const size = await page
    .locator('canvas')
    .evaluate((canvas: HTMLCanvasElement) => ({
      width: canvas.width,
      height: canvas.height,
    }));
  expect(png.readUInt32BE(16)).toBe(size.width);
  expect(png.readUInt32BE(20)).toBe(size.height);
  expect(size.width).toBeGreaterThan(390);
  await context.close();
});
