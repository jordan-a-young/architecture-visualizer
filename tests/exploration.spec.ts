import { expect, test } from '@playwright/test';
test('search preserves context, focus centers a node, and labels inspect edges', async ({
  page,
}) => {
  await page.goto('/interaction-test.html');
  await expect(page.locator('.av-node-label')).toHaveCount(3);
  await page.getByText('Browse nodes (3)').click();
  await page.getByRole('searchbox', { name: 'Search nodes' }).fill('Database');
  const list = page.locator('.av-node-list');
  await expect(
    list.getByRole('button', { name: 'Database', exact: true }),
  ).toBeVisible();
  await expect(
    list.getByRole('button', { name: 'Custom node', exact: true }),
  ).toHaveCount(0);
  await expect(page.locator('.av-node-label')).toHaveCount(3);
  await list.getByRole('button', { name: 'Database', exact: true }).click();
  await page.getByText('Browse nodes (3)').click();
  await page.getByRole('button', { name: 'Focus node', exact: true }).click();
  await expect(async () => {
    const label = await page.locator('[data-node-id="b"]').boundingBox();
    const canvas = await page.locator('canvas').boundingBox();
    expect(
      Math.abs(label!.x + label!.width / 2 - (canvas!.x + canvas!.width / 2)),
    ).toBeLessThan(2);
  }).toPass();
  await page.getByRole('button', { name: 'Reset camera', exact: true }).click();
  await page
    .getByRole('button', { name: 'Inspect relationship: reads' })
    .click();
  await expect(page.getByLabel('Relationship details')).toContainText('reads');
  await page
    .getByLabel('Relationship details')
    .getByRole('button', { name: 'Database', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Database', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Clear selection', exact: true })
    .click();
  const relationship = page.getByRole('button', {
    name: 'Inspect relationship: reads',
  });
  const box = await relationship.boundingBox();
  const style = await page.addStyleTag({
    content:
      'div:has(> .av-edge-label) { visibility: hidden !important; pointer-events: none !important; }',
  });
  const point = { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
  await page.mouse.click(point.x, point.y);
  await expect(page.getByLabel('Relationship details')).toBeVisible();
  await style.evaluate((element) => element.parentNode?.removeChild(element));
  await page.screenshot({ path: 'artifacts/exploration.png' });
});

test('keyboard relationship browsing remains available without WebGL', async ({
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
  await page.goto('/interaction-test.html');
  await page.getByText('Browse nodes (3)').click();
  await page.getByText('Relationships (1)').click();
  await page
    .getByRole('button', { name: 'Custom node → Database · reads' })
    .click();
  await expect(page.getByLabel('Relationship details')).toContainText(
    'Custom node',
  );
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('heading', { name: 'Explore your system' }),
  ).toBeVisible();
});
