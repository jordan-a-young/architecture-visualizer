import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type {
  CameraState,
  ViewerViewState,
} from '../packages/react/src/viewState.js';

async function state(page: Page): Promise<ViewerViewState> {
  await page.getByRole('button', { name: 'Read state', exact: true }).click();
  return JSON.parse((await page.getByLabel('View state').textContent())!);
}
async function ready(page: Page, query = '') {
  await page.goto(`/regression-test.html${query}`);
  await expect(
    page.getByRole('button', { name: 'Download PNG', exact: true }),
  ).toBeEnabled();
}
function sameCamera(
  actual: CameraState | null,
  expected: CameraState | null,
  precision = 4,
) {
  expect(actual).not.toBeNull();
  expect(expected).not.toBeNull();
  for (const key of ['position', 'target'] as const)
    actual![key].forEach((value, i) =>
      expect(value).toBeCloseTo(expected![key][i]!, precision),
    );
}

test('resizing and entering/exiting fullscreen preserve the exact camera view', async ({
  page,
}) => {
  await ready(page);
  await page.getByRole('button', { name: 'Restore known camera' }).click();
  const before = (await state(page)).camera;
  const originalWidth = await page.locator('canvas').getAttribute('width');
  await page.setViewportSize({ width: 1200, height: 900 });
  await expect
    .poll(() => page.locator('canvas').getAttribute('width'))
    .not.toBe(originalWidth);
  await expect(async () =>
    sameCamera((await state(page)).camera, before),
  ).toPass();
  const embeddedHeight = await page.locator('canvas').getAttribute('height');
  await page.getByRole('button', { name: 'Enter fullscreen' }).click();
  await expect(
    page.getByRole('button', { name: 'Exit fullscreen' }),
  ).toBeVisible();
  await expect
    .poll(() => page.locator('canvas').getAttribute('height'))
    .not.toBe(embeddedHeight);
  // The fixture's state reader is outside fullscreen; leave through the browser API.
  await page.evaluate(() => document.exitFullscreen());
  await expect(
    page.getByRole('button', { name: 'Enter fullscreen' }),
  ).toBeVisible();
  await expect(page.locator('canvas')).toHaveAttribute(
    'height',
    embeddedHeight!,
  );
  await expect(async () =>
    sameCamera((await state(page)).camera, before),
  ).toPass();
});

for (const choice of ['automatic', 'restored', 'focused', 'orbited'] as const) {
  test(`delayed layouts respect the ${choice} camera, with explicit reset still available`, async ({
    page,
  }) => {
    await ready(page, '?async');
    await expect(
      page.getByText('Arranging graph…', { exact: true }),
    ).toBeVisible();
    if (choice === 'restored')
      await page.getByRole('button', { name: 'Restore known camera' }).click();
    if (choice === 'focused')
      await page.getByRole('button', { name: 'Focus Alpha' }).click();
    if (choice === 'orbited') {
      const initial = (await state(page)).camera!;
      const rect = (await page.locator('canvas').boundingBox())!;
      await page.mouse.move(rect.x + 40, rect.y + 40);
      await page.mouse.down();
      await page.mouse.move(rect.x + 140, rect.y + 40, { steps: 8 });
      await page.mouse.up();
      // OrbitControls can stop invalidating with subpixel damping remaining.
      // Allow <0.005 world units for manual views; explicit views use 0.00005.
      await expect(async () => {
        const previous = (await state(page)).camera;
        await page.waitForTimeout(500);
        sameCamera((await state(page)).camera, previous, 2);
      }).toPass({ timeout: 20_000 });
      expect(
        Math.abs((await state(page)).camera!.position[0] - initial.position[0]),
      ).toBeGreaterThan(1);
    }
    const before = (await state(page)).camera;
    await page.getByRole('button', { name: 'Finish layout' }).click();
    await expect(
      page.getByText('Arranging graph…', { exact: true }),
    ).toHaveCount(0);
    if (choice === 'automatic')
      expect((await state(page)).camera!.target).toEqual([8, 0, 8]);
    else
      sameCamera(
        (await state(page)).camera,
        before,
        choice === 'orbited' ? 2 : 4,
      );
    await page
      .getByRole('button', { name: 'Reset camera', exact: true })
      .click();
    await expect(async () =>
      expect((await state(page)).camera!.target).toEqual([8, 0, 8]),
    ).toPass();
    await page.getByRole('button', { name: 'Top view', exact: true }).click();
    await expect(async () => {
      const top = (await state(page)).camera!;
      expect(top.position[0]).toBeCloseTo(8, 4);
      expect(top.position[2]).toBeCloseTo(8, 1);
      expect(top.position[1]).toBeGreaterThan(10);
    }).toPass();
  });
}

for (const controlled of [false, true]) {
  test(`cancelling a drag restores absent and existing overrides (${controlled ? 'controlled' : 'internal'})`, async ({
    page,
  }) => {
    await ready(page, controlled ? '?controlled' : '');
    const node = page.locator('[data-node-id="a"]');
    await expect(node).toBeVisible();
    for (const finish of ['escape', 'commit', 'pointercancel']) {
      const before = (await state(page)).nodePositions;
      const rect = (await node.boundingBox())!;
      await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
      await page.mouse.down();
      await page.mouse.move(
        rect.x + rect.width / 2 + 65,
        rect.y + rect.height / 2 + 30,
        { steps: 8 },
      );
      if (finish === 'escape') await page.keyboard.press('Escape');
      if (finish === 'pointercancel')
        await page
          .locator('canvas')
          .dispatchEvent('pointercancel', { pointerId: 1, isPrimary: true });
      await page.mouse.up();
      const after = (await state(page)).nodePositions;
      if (finish === 'commit') expect(after.a).not.toEqual(before.a);
      else expect(after).toEqual(before);
    }
  });
}

test('mixed explicit and anonymous edge IDs stay correct across filtering and selection', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await ready(page);
  await expect(page.locator('.av-edge-label')).toHaveCount(2);
  for (let cycle = 0; cycle < 2; cycle++) {
    await page.getByRole('button', { name: 'Toggle filter' }).click();
    await expect(page.locator('.av-toolbar')).toContainText(
      '2 nodes · 1 relationships',
    );
    await expect(page.locator('.av-edge-label')).toHaveText(['Second']);
    await page.locator('.av-edge-label').click();
    await expect(page.locator('.av-details')).toContainText('Second');
    await page.getByRole('button', { name: 'Toggle filter' }).click();
    await expect(page.locator('.av-edge-label')).toHaveCount(2);
  }
  expect(errors.filter((message) => message.includes('same key'))).toEqual([]);
  await page.screenshot({ path: 'artifacts/viewer-review-regressions.png' });
});
