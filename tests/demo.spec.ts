import { expect, test } from '@playwright/test';
test('real 3D scene, inspection, navigation, filters and offline assets', async ({
  page,
}) => {
  const errors: string[] = [];
  const externalRequests: string[] = [];
  page.on('pageerror', (error) => {
    errors.push(error.message);
    console.log('PAGE ERROR', error.message);
  });
  page.on('console', (message) => {
    if (message.type() === 'error')
      console.log('BROWSER ERROR', message.text());
  });
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') {
      externalRequests.push(url.href);
      return route.abort();
    }
    return route.continue();
  });
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.av-node-label')).toHaveCount(10, {
    timeout: 20000,
  });
  await page
    .locator('.av-node-label')
    .filter({ hasText: 'Orders Service' })
    .click();
  const panel = page.getByRole('complementary');
  await expect(
    panel.getByRole('heading', { name: 'Orders Service', exact: true }),
  ).toBeVisible();
  await expect(panel.getByText('Platform', { exact: true })).toBeVisible();
  await expect(panel.getByRole('link', { name: /README/ })).toHaveAttribute(
    'href',
    'https://example.com/docs/orders',
  );
  await expect(panel.getByRole('link', { name: /README/ })).toHaveAttribute(
    'target',
    '_blank',
  );
  await expect(
    panel.getByRole('heading', { name: /Dependencies/ }),
  ).toBeVisible();
  await panel.getByRole('button', { name: /Orders Database/ }).click();
  await expect(
    panel.getByRole('heading', { name: 'Orders Database', exact: true }),
  ).toBeVisible();
  await page
    .locator('.av-node-label')
    .filter({ hasText: 'Orders Service' })
    .click();
  await page.screenshot({ path: 'artifacts/demo-selected.png' });
  await page.getByRole('button', { name: 'Reset camera', exact: true }).click();
  await expect(page.locator('.av-node-label')).toHaveCount(10, {
    timeout: 20000,
  });
  await page.locator('canvas').click({ position: { x: 15, y: 200 } });
  await expect(
    panel.getByRole('heading', { name: 'Explore your system' }),
  ).toBeVisible();
  await page.getByLabel('Node type', { exact: true }).selectOption('database');
  await expect(page.locator('.av-node-label')).toHaveCount(2);
  await page.getByLabel('Node type', { exact: true }).selectOption('all');
  await page
    .locator('.av-node-label')
    .filter({ hasText: 'Users Service' })
    .click();
  await page.keyboard.press('Escape');
  await expect(
    panel.getByRole('heading', { name: 'Explore your system' }),
  ).toBeVisible();
  await page.getByLabel('Relationship labels').check();
  await expect(page.locator('.av-edge-label')).toHaveCount(14);
  expect(errors).toEqual([]);
  expect(externalRequests).toEqual([]);
  // User-activated navigation is allowed; intercept its destination for an offline test.
  await page.context().route('https://example.com/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<title>Example documentation</title><p>README destination</p>',
    }),
  );
  await page
    .locator('.av-node-label')
    .filter({ hasText: 'Orders Service' })
    .click();
  const opened = page.waitForEvent('popup');
  await panel.getByRole('link', { name: /README/ }).click();
  const documentation = await opened;
  await expect(documentation).toHaveURL('https://example.com/docs/orders');
  await expect(documentation.getByText('README destination')).toBeVisible();
  await documentation.close();
});
test('mobile viewport keeps controls and inspector reachable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page
    .locator('.av-node-label')
    .filter({ hasText: 'Web Application' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Web Application', exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});

test('no WebGL preserves the keyboard-accessible inspector', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      ...args: Parameters<typeof original>
    ) {
      if (String(args[0]).startsWith('webgl')) return null;
      return original.apply(this, args);
    } as typeof original;
  });
  await page.goto('/');
  await expect(page.getByRole('status')).toContainText('requires WebGL2');
  await page.getByText('Browse nodes (10)').click();
  await page
    .locator('.av-node-list')
    .getByRole('button', { name: 'Orders Service' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Orders Service', exact: true }),
  ).toBeVisible();
});
