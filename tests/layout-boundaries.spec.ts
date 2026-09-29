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

test('demo layout controls switch direction, boundaries and camera while keeping the graph inspectable', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.av-node-label')).toHaveCount(10);
  await expect(page.getByText('Arranging graph…', { exact: true })).toHaveCount(
    0,
  );
  await expect(page.locator('.av-group-label')).toHaveCount(5);
  await page.getByRole('button', { name: 'Top view', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Download PNG', exact: true }),
  ).toBeEnabled();
  await expect(page.locator('.av-node-label')).toHaveCount(10);
  await page
    .locator('.viewer-shell')
    .screenshot({ path: 'artifacts/advanced-layout-top.png' });
  await page
    .getByRole('combobox', { name: 'Direction', exact: true })
    .selectOption('DOWN');
  await expect(page.getByText('Arranging graph…', { exact: true })).toHaveCount(
    0,
  );
  await page
    .getByRole('combobox', { name: 'Spacing', exact: true })
    .selectOption('5');
  await expect(page.getByText('Arranging graph…', { exact: true })).toHaveCount(
    0,
  );
  await page
    .getByRole('checkbox', { name: 'Group boundaries', exact: true })
    .uncheck();
  await expect(page.locator('.av-group-label')).toHaveCount(0);
  await page
    .getByRole('checkbox', { name: 'Group boundaries', exact: true })
    .check();
  await page.getByLabel('Node type', { exact: true }).selectOption('service');
  await expect(page.locator('.av-node-label')).toHaveCount(3);
  await page
    .getByRole('button', { name: 'Arrange visible', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Arrange visible', exact: true }),
  ).toBeEnabled();
  await page
    .locator('.av-node-label')
    .filter({ hasText: 'Orders Service' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Orders Service', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Reset layout', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Layout', exact: true })
    .selectOption('basic');
  await expect(
    page.getByRole('combobox', { name: 'Direction', exact: true }),
  ).toBeDisabled();
});
