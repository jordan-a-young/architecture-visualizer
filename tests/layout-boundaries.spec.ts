import { expect, test } from '@playwright/test';
test('advanced layout shows nested deployment boundaries, exports them, and preserves inspection through collapse', async ({
  page,
}) => {
  const external: string[] = [];
  page.on('request', (r) => {
    if (
      !r.url().startsWith('http://127.0.0.1:5173') &&
      !r.url().startsWith('data:')
    )
      external.push(r.url());
  });
  await page.goto('/interaction-test.html?groups&layout');
  await expect(page.locator('.av-node-label')).toHaveCount(3);
  await expect(page.getByText('Arranging graph…', { exact: true })).toHaveCount(
    0,
  );
  await expect(page.locator('.av-group-label')).toHaveCount(2);
  await expect(
    page.locator('.av-group-label[data-group-id="services"]'),
  ).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PNG', exact: true }).click();
  await (await download).saveAs('artifacts/deployment-boundaries.png');
  await page.screenshot({ path: 'artifacts/deployment-boundaries-ui.png' });
  await page
    .getByRole('button', { name: 'Collapse group: Services', exact: true })
    .click();
  await expect(page.locator('.av-group-label')).toHaveCount(1);
  await page
    .getByRole('button', { name: 'Inspect relationship: calls', exact: true })
    .click();
  await expect(page.getByLabel('Relationship details')).toContainText(
    'Custom node',
  );
  await page.locator('.av-node-label').filter({ hasText: 'Services' }).click();
  await expect(page.locator('.av-group-label')).toHaveCount(2);
  expect(external).toEqual([]);
});
test('boundaries follow dragged nodes and label clicks respect controlled collapse', async ({
  page,
}) => {
  await page.goto('/interaction-test.html?groups&layout&controlled');
  await expect(page.getByText('Arranging graph…', { exact: true })).toHaveCount(
    0,
  );
  const node = page.locator('.av-node-label[data-node-id="a"]');
  await expect(node).toBeVisible();
  const before = await page.locator('[data-group-id="services"]').boundingBox();
  const box = (await node.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 - 90,
    box.y + box.height / 2 + 70,
    { steps: 12 },
  );
  await page.mouse.up();
  await expect(page.getByLabel('Drag ends', { exact: true })).toHaveText('1');
  await expect
    .poll(async () => {
      const after = await page
        .locator('[data-group-id="services"]')
        .boundingBox();
      return Math.hypot(after!.x - before!.x, after!.y - before!.y);
    })
    .toBeGreaterThan(10);
  await page
    .getByRole('button', { name: 'Inspect relationship: calls', exact: true })
    .click();
  await expect(page.getByLabel('Relationship details')).toContainText(
    'Custom node',
  );
  await page.goto('/interaction-test.html?groups&layout&controlled&reject');
  await expect(page.locator('.av-group-label')).toHaveCount(2);
  await page
    .getByRole('button', { name: 'Collapse group: Services', exact: true })
    .click();
  await expect(page.locator('.av-group-label')).toHaveCount(2);
});
