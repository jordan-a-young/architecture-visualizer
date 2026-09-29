import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const fullName =
  'A very long service name that should stay readable in the inspector';

// Inspect real WebGL pixels, not the label placement implementation's rectangles.
async function geometryReport(page: Page) {
  const pending = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Export without labels', exact: true })
    .click();
  const result = await pending;
  const path = await result.path();
  const png = (await readFile(path!)).toString('base64');
  return page.evaluate(async (png) => {
    const image = new Image();
    image.src = `data:image/png;base64,${png}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, image.width, image.height).data;
    const rect = document.querySelector('canvas')!.getBoundingClientRect();
    const labels = [...document.querySelectorAll('.av-node-label')]
      .filter((label) => getComputedStyle(label).visibility === 'visible')
      .map((label) => label.getBoundingClientRect());
    let total = 0,
      covered = 0;
    let meshPoint: { x: number; y: number } | null = null;
    for (let y = 0; y < image.height; y++)
      for (let x = 0; x < image.width; x++) {
        const i = (y * image.width + x) * 4;
        if (
          pixels[i]! > 100 &&
          pixels[i]! > pixels[i + 1]! * 1.5 &&
          pixels[i]! > pixels[i + 2]! * 1.3
        ) {
          total++;
          const point = {
            x: rect.left + (x * rect.width) / image.width,
            y: rect.top + (y * rect.height) / image.height,
          };
          // Pick an interior pixel that is not behind a toolbar or label.
          const inset = 8;
          const inner =
            y >= inset &&
            y < image.height - inset &&
            x >= inset &&
            x < image.width - inset &&
            [
              [x - inset, y],
              [x + inset, y],
              [x, y - inset],
              [x, y + inset],
            ].every(([px, py]) => {
              const j = (py! * image.width + px!) * 4;
              return (
                pixels[j]! > pixels[j + 1]! * 1.5 &&
                pixels[j]! > pixels[j + 2]! * 1.3
              );
            });
          if (
            !meshPoint &&
            inner &&
            document.elementFromPoint(point.x, point.y)?.tagName === 'CANVAS'
          )
            meshPoint = point;
          if (
            labels.some(
              (label) =>
                point.x >= label.left &&
                point.x <= label.right &&
                point.y >= label.top &&
                point.y <= label.bottom,
            )
          )
            covered++;
        }
      }
    return { total, covered, meshPoint };
  }, png);
}

test('compact captions stay off real custom geometry in perspective, top view and after zoom', async ({
  page,
}) => {
  await page.goto('/interaction-test.html?labels');
  const label = page.locator('.av-node-label[data-node-id="a"]');
  await expect(label).toBeVisible();
  const size = (await label.boundingBox())!;
  expect(size.height).toBeLessThanOrEqual(24);
  expect(size.width).toBeLessThanOrEqual(160);
  await expect(label).toHaveAttribute('aria-label', fullName);
  await expect(label).toHaveAttribute('title', `${fullName} · custom`);
  await label.click();
  await expect(
    page.getByRole('heading', { name: fullName, exact: true }),
  ).toBeVisible();
  for (const view of ['perspective', 'top', 'zoom']) {
    if (view === 'top')
      await page.getByRole('button', { name: 'Top view', exact: true }).click();
    if (view === 'zoom') {
      const canvas = (await page.locator('canvas').boundingBox())!;
      await page.mouse.move(canvas.x + 20, canvas.y + canvas.height - 60);
      await page.mouse.wheel(0, -180);
    }
    await expect(
      page.getByRole('button', { name: 'Download PNG', exact: true }),
    ).toBeEnabled();
    await expect(label).toBeVisible();
    await expect(async () => {
      const before = (await label.boundingBox())!;
      await page.waitForTimeout(150);
      const after = (await label.boundingBox())!;
      expect(
        Math.abs(before.x - after.x) + Math.abs(before.y - after.y),
      ).toBeLessThan(0.2);
    }).toPass();
    const report = await geometryReport(page);
    expect(report.total).toBeGreaterThan(100);
    expect(report.covered).toBe(0);
  }
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PNG', exact: true }).click();
  await (await pending).saveAs('artifacts/compact-labels-export.png');
  await page.screenshot({ path: 'artifacts/compact-labels-custom.png' });
});

test('label modes preserve mesh hover, selection and keyboard inspection', async ({
  page,
}) => {
  await page.goto('/interaction-test.html?labels');
  const labels = page.locator('.av-node-label:visible');
  await expect(labels).toHaveCount(3);
  const report = await geometryReport(page);
  const mode = page.getByRole('combobox', { name: 'Node labels', exact: true });
  await mode.selectOption('selected');
  await expect(labels).toHaveCount(0);
  await page.mouse.move(report.meshPoint!.x, report.meshPoint!.y);
  await expect(labels).toHaveCount(1);
  await page.mouse.click(report.meshPoint!.x, report.meshPoint!.y);
  await page.mouse.move(10, 10);
  await expect(labels).toHaveCount(1);
  await mode.selectOption('none');
  await expect(labels).toHaveCount(0);
  await page.getByText('Browse nodes (3)', { exact: true }).click();
  const entry = page
    .locator('.av-node-list')
    .getByRole('button', { name: fullName, exact: true });
  await entry.focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('heading', { name: fullName, exact: true }),
  ).toBeVisible();
  await expect(labels).toHaveCount(0);
  await mode.selectOption('selected');
  await expect(page.locator('.av-node-label[data-node-id="a"]')).toBeVisible();
});

test('automatic labels yield to geometry when zoomed out and return on reset', async ({
  page,
}) => {
  await page.goto('/interaction-test.html?labels');
  await expect(page.locator('.av-node-label:visible')).toHaveCount(3);
  const canvas = (await page.locator('canvas').boundingBox())!;
  await page.mouse.move(canvas.x + 15, canvas.y + canvas.height - 50);
  for (let step = 0; step < 60; step++) {
    await page.mouse.wheel(0, 200);
    await page.waitForTimeout(30);
  }
  await expect(async () =>
    expect(await page.locator('.av-node-label:visible').count()).toBeLessThan(
      3,
    ),
  ).toPass();
  await page.getByRole('button', { name: 'Reset camera', exact: true }).click();
  await expect(page.locator('.av-node-label:visible')).toHaveCount(3);
});

test('captions return after filtering in an idle canvas', async ({ page }) => {
  await page.goto('/interaction-test.html');
  await expect(page.locator('.av-node-label:visible')).toHaveCount(3);
  await page
    .getByRole('button', { name: 'Toggle filter', exact: true })
    .click();
  await expect(page.locator('.av-node-label:visible')).toHaveCount(2);
  await page
    .getByRole('button', { name: 'Toggle filter', exact: true })
    .click();
  await expect(page.locator('.av-node-label:visible')).toHaveCount(3);
});

test('compact captions leave custom geometry visible on a narrow screen', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/interaction-test.html?labels');
  await expect(page.locator('.av-node-label:visible').first()).toBeVisible();
  const report = await geometryReport(page);
  expect(report.total).toBeGreaterThan(50);
  expect(report.covered).toBe(0);
  await page.screenshot({ path: 'artifacts/compact-labels-mobile.png' });
});
