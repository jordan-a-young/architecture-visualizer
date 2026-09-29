import { expect, test } from '@playwright/test';
import type { Locator } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function opacity(label: Locator) {
  return label.evaluate((element) => {
    let opacity = 1;
    for (
      let parent: Element | null = element;
      parent;
      parent = parent.parentElement
    )
      opacity *= Number(getComputedStyle(parent).opacity);
    return opacity;
  });
}

test('legend highlights visible styles, preserves selection and clears stale entries', async ({
  page,
}) => {
  await page.goto('/interaction-test.html?legend');
  const legend = page.getByRole('list', { name: 'Relationship styles' });
  const call = legend.getByRole('button', { name: /^Synchronous call, solid/ });
  const dotted = legend.getByRole('button', {
    name: /^Code dependency, dotted/,
  });
  await expect(legend.getByRole('button')).toHaveCount(4);
  await expect(
    legend.getByRole('button', { name: /^Code dependency, dashed/ }),
  ).toBeVisible();
  const callLabel = page.getByRole('button', {
    name: 'Inspect relationship: calls',
    exact: true,
  });
  const eventLabel = page.getByRole('button', {
    name: 'Inspect relationship: events',
    exact: true,
  });
  await expect(callLabel).toBeVisible();
  await call.hover();
  await expect.poll(() => opacity(callLabel)).toBe(1);
  await expect.poll(() => opacity(eventLabel)).toBe(0.16);
  await page.mouse.move(10, 10);
  await expect.poll(() => opacity(callLabel)).toBe(0.62);
  await callLabel.click();
  await expect(
    page.getByRole('heading', { name: 'calls', exact: true }),
  ).toBeVisible();
  await dotted.focus();
  await page.keyboard.press('Enter');
  await expect(dotted).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => opacity(callLabel)).toBe(1);
  await expect.poll(() => opacity(eventLabel)).toBe(0.16);
  await page.keyboard.press('Escape');
  await expect(dotted).toHaveAttribute('aria-pressed', 'false');
  await expect(
    page.getByRole('heading', { name: 'calls', exact: true }),
  ).toBeVisible();
  await dotted.click();
  await page
    .getByRole('button', { name: 'Toggle filter', exact: true })
    .click();
  await expect(legend.getByRole('button')).toHaveCount(1);
  await expect(call).toBeVisible();
  await page
    .getByRole('button', { name: 'Toggle filter', exact: true })
    .click();
  await expect(legend.getByRole('button')).toHaveCount(4);
  await expect(dotted).toHaveAttribute('aria-pressed', 'false');
  await page.screenshot({ path: 'artifacts/relationship-legend.png' });
});

test('legend stays below the canvas and supports pinning on narrow screens', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/interaction-test.html?legend');
  const legend = page.locator('.av-relationship-legend');
  await expect(legend).toBeVisible();
  const canvas = (await page.locator('canvas').boundingBox())!;
  const bounds = (await legend.boundingBox())!;
  expect(bounds.y).toBeGreaterThanOrEqual(canvas.y + canvas.height - 1);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  const dotted = legend.getByRole('button', {
    name: /^Code dependency, dotted/,
  });
  await dotted.click();
  await expect(dotted).toHaveAttribute('aria-pressed', 'true');
  await legend.locator('summary').click();
  await legend.locator('summary').click();
  await expect(dotted).toHaveAttribute('aria-pressed', 'false');
  await page.screenshot({ path: 'artifacts/relationship-legend-mobile.png' });
});

test('solid, dashed and dotted patterns export real pixels and gaps remain selectable', async ({
  page,
}) => {
  const reports: Record<string, { runs: number; longest: number }> = {};
  for (const pattern of ['solid', 'dashed', 'dotted']) {
    await page.goto(`/interaction-test.html?legend&pattern=${pattern}`);
    await expect(
      page.getByRole('button', { name: 'Download PNG', exact: true }),
    ).toBeEnabled();
    await page.getByRole('button', { name: 'Top view', exact: true }).click();
    const label = page.locator('.av-edge-label');
    await expect(label).toBeVisible();
    await expect(async () => {
      const before = (await label.boundingBox())!;
      await page.waitForTimeout(150);
      const after = (await label.boundingBox())!;
      expect(
        Math.abs(before.x - after.x) + Math.abs(before.y - after.y),
      ).toBeLessThan(0.1);
    }).toPass();
    const pending = page.waitForEvent('download');
    await page
      .getByRole('button', { name: 'Export without labels', exact: true })
      .click();
    const download = await pending;
    await download.saveAs(`artifacts/relationship-${pattern}.png`);
    const png = (await readFile((await download.path())!)).toString('base64');
    const report = await page.evaluate(async (png) => {
      const image = new Image();
      image.src = `data:image/png;base64,${png}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d')!;
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, image.width, image.height).data;
      const source = document.querySelector('canvas')!;
      const bounds = source.getBoundingClientRect();
      const runs: number[] = [];
      let previous = false,
        length = 0,
        gapX = 0,
        lineY = 0;
      // Central section of the route excludes node geometry and the arrowhead.
      for (
        let x = Math.floor(image.width * 0.38);
        x < image.width * 0.48;
        x++
      ) {
        let red = false;
        for (let y = 0; y < image.height; y++) {
          const i = (y * image.width + x) * 4;
          if (
            pixels[i]! > pixels[i + 1]! * 1.25 &&
            pixels[i]! > pixels[i + 2]! * 1.25
          ) {
            red = true;
            lineY = y;
          }
        }
        if (red) length++;
        else if (previous) {
          runs.push(length);
          length = 0;
          gapX = x + 1;
        }
        previous = red;
      }
      if (length) runs.push(length);
      return {
        runs: runs.length,
        longest: Math.max(0, ...runs),
        width: image.width,
        height: image.height,
        expectedWidth: source.width,
        expectedHeight: source.height,
        gap: {
          x: bounds.left + (gapX * bounds.width) / image.width,
          y: bounds.top + (lineY * bounds.height) / image.height,
        },
      };
    }, png);
    expect(report.width).toBe(report.expectedWidth);
    expect(report.height).toBe(report.expectedHeight);
    expect(report.runs).toBeGreaterThan(0);
    reports[pattern] = report;
    if (pattern === 'dotted') {
      await page.mouse.click(report.gap.x, report.gap.y);
      await expect(
        page.getByRole('heading', { name: 'preview', exact: true }),
      ).toBeVisible();
    }
  }
  expect(reports.solid!.runs).toBe(1);
  expect(reports.dashed!.runs).toBeGreaterThan(1);
  expect(reports.dotted!.runs).toBeGreaterThan(reports.dashed!.runs);
  expect(reports.dashed!.longest).toBeGreaterThan(reports.dotted!.longest);
});
