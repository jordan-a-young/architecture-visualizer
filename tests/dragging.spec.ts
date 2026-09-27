import { expect, test } from '@playwright/test';
import type { Page, Locator } from '@playwright/test';

async function box(locator: Locator) {
  const rect = await locator.boundingBox();
  expect(rect).not.toBeNull();
  return rect!;
}
async function drag(page: Page, node: Locator, x = 90, y = 35, mesh = false) {
  const rect = await box(node);
  const start = {
    x: rect.x + rect.width / 2,
    y: mesh ? rect.y - 28 : rect.y + rect.height / 2,
  };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + x, start.y + y, { steps: 12 });
  await page.mouse.up();
}
async function positions(
  page: Page,
): Promise<Record<string, [number, number, number]>> {
  return JSON.parse(
    (await page.getByLabel('Positions', { exact: true }).textContent())!,
  );
}
function expectSame(a: { x: number; y: number }, b: { x: number; y: number }) {
  expect(Math.abs(a.x - b.x)).toBeLessThan(0.5);
  expect(Math.abs(a.y - b.y)).toBeLessThan(0.5);
}

test('drag labels and custom meshes while camera, selection and edges remain coherent', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/interaction-test.html');
  const a = page.locator('[data-node-id="a"]');
  const b = page.locator('[data-node-id="b"]');
  const c = page.locator('[data-node-id="c"]');
  await expect(a).toBeVisible();
  await a.click();
  await expect(a).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Drag ends')).toHaveText('0');
  const initial = await box(a);
  const stationaryB = await box(b);
  const stationaryC = await box(c);
  const edge = await box(page.locator('.av-edge-label'));
  await drag(page, a);
  await expect(page.getByLabel('Drag ends')).toHaveText('1');
  const moved = (await positions(page)).a!;
  expect(moved.every(Number.isFinite)).toBe(true);
  expect(moved[1]).toBe(0);
  expect(Math.abs((await box(a)).x - initial.x)).toBeGreaterThan(50);
  expectSame(await box(b), stationaryB);
  expectSame(await box(c), stationaryC);
  expect(
    Math.abs((await box(page.locator('.av-edge-label'))).x - edge.x),
  ).toBeGreaterThan(10);
  await expect(a).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: 'artifacts/dragged-node.png' });
  // The position state survives filters, selection changes and camera reset.
  await page.getByRole('button', { name: 'Toggle filter' }).click();
  await expect(c).toHaveCount(0);
  await page.getByRole('button', { name: 'Toggle filter' }).click();
  await b.click();
  await page.getByRole('button', { name: 'Reset camera', exact: true }).click();
  await expect(a).toBeVisible();
  expect((await positions(page)).a).toEqual(moved);
  // Mesh interaction uses the same movement contract as its HTML label.
  await drag(page, a, -60, 25, true);
  await expect(page.getByLabel('Drag ends')).toHaveText('2');
  expect((await positions(page)).a).not.toEqual(moved);
  await page.getByRole('button', { name: 'Reset layout', exact: true }).click();
  expect(await positions(page)).toEqual({});
  // Ordinary orbiting works again after the drag releases its pointer.
  const beforeOrbit = await box(b);
  const canvas = await box(page.locator('canvas'));
  await page.mouse.move(canvas.x + 30, canvas.y + canvas.height - 100);
  await page.mouse.down();
  await page.mouse.move(canvas.x + 160, canvas.y + canvas.height - 70, {
    steps: 10,
  });
  await page.mouse.up();
  await expect
    .poll(async () => Math.abs((await box(b)).x - beforeOrbit.x))
    .toBeGreaterThan(10);
  expect(errors).toEqual([]);
});

test('controlled positions and filtering during drag preserve the camera', async ({
  page,
}) => {
  await page.goto('/interaction-test.html?controlled');
  const a = page.locator('[data-node-id="a"]');
  const b = page.locator('[data-node-id="b"]');
  await expect(a).toBeVisible();
  await page.getByRole('button', { name: 'Toggle filter' }).click();
  const before = await box(b);
  await drag(page, a);
  await expect(page.getByLabel('Drag ends')).toHaveText('1');
  expectSame(await box(b), before);
  expect((await positions(page)).a![1]).toBe(0);
  await page.getByRole('button', { name: 'Reset layout' }).click();
  expect(await positions(page)).toEqual({});
});

test('controlled consumers can decline changes; disabling dragging preserves click selection', async ({
  page,
}) => {
  await page.goto('/interaction-test.html?controlled&reject');
  const a = page.locator('[data-node-id="a"]');
  await expect(a).toBeVisible();
  const before = await box(a);
  await drag(page, a);
  expectSame(await box(a), before);
  expect(await positions(page)).toEqual({});
  await page.getByRole('button', { name: 'Toggle dragging' }).click();
  await a.click();
  await expect(a).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Reset layout' })).toHaveCount(
    0,
  );
});

test('Escape and pointer cancellation roll back movement and restore controls', async ({
  page,
}) => {
  await page.goto('/interaction-test.html');
  const a = page.locator('[data-node-id="a"]');
  const b = page.locator('[data-node-id="b"]');
  await expect(a).toBeVisible();
  const original = await box(a);
  for (const cancellation of ['escape', 'pointercancel']) {
    const rect = await box(a);
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      rect.x + rect.width / 2 + 80,
      rect.y + rect.height / 2 + 30,
      { steps: 8 },
    );
    if (cancellation === 'escape') await page.keyboard.press('Escape');
    else
      await page
        .locator('canvas')
        .dispatchEvent('pointercancel', { pointerId: 1, isPrimary: true });
    await page.mouse.up();
    await expect(async () => expectSame(await box(a), original)).toPass();
    await expect(page.getByLabel('Drag ends')).toHaveText('0');
  }
  await b.click();
  await expect(b).toHaveAttribute('aria-pressed', 'true');
  await drag(page, a);
  await expect(page.getByLabel('Drag ends')).toHaveText('1');
});

test('touch pointer can drag a label without scrolling the page', async ({
  page,
}) => {
  await page.goto('/interaction-test.html');
  const a = page.locator('[data-node-id="a"]');
  await expect(a).toBeVisible();
  // Real touch input through Chromium's protocol, not synthetic DOM pointer events.
  const session = await page.context().newCDPSession(page);
  const rect = await box(a);
  const x = rect.x + rect.width / 2,
    y = rect.y + rect.height / 2;
  const scroll = await page.evaluate(() => window.scrollY);
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y, id: 1 }],
  });
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: x + 75, y: y + 25, id: 1 }],
  });
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await expect(page.getByLabel('Drag ends')).toHaveText('1');
  expect((await positions(page)).a![1]).toBe(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(scroll);
  await session.detach();
});
