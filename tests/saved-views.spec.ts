import { expect, test } from '@playwright/test';
test('saved view restores camera, dragged positions, filters and selection after reload', async ({
  page,
}) => {
  await page.goto('/interaction-test.html?saved');
  await expect(page.locator('.av-node-label')).toHaveCount(3);
  const a = page.locator('[data-node-id="a"]');
  const box = await a.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box!.x + box!.width / 2 + 55,
    box!.y + box!.height / 2 + 30,
    { steps: 8 },
  );
  await page.mouse.up();
  await a.click();
  await page
    .getByRole('button', { name: 'Toggle filter', exact: true })
    .click();
  await page.getByRole('button', { name: 'Focus node', exact: true }).click();
  await expect(page.locator('.av-node-label')).toHaveCount(2);
  await page
    .getByLabel('View name', { exact: true })
    .fill('Focused custom node');
  await page.getByRole('button', { name: 'Save view', exact: true }).click();
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem('archgraph-demo-views-v1')!)[0].state,
  );
  expect(saved.nodePositions.a).toBeDefined();
  expect(saved.camera).not.toBeNull();
  await page.reload();
  await expect(page.locator('.av-node-label')).toHaveCount(3);
  await page
    .getByRole('combobox', { name: 'Saved view', exact: true })
    .selectOption('Focused custom node');
  await page.getByRole('button', { name: 'Restore view', exact: true }).click();
  await expect(page.locator('.av-node-label')).toHaveCount(2);
  await expect(
    page.getByRole('heading', { name: 'Custom node', exact: true }),
  ).toBeVisible();
  await expect(async () => {
    await page
      .getByRole('button', { name: 'Inspect view state', exact: true })
      .click();
    const restored = JSON.parse(
      (await page.getByLabel('View state', { exact: true }).textContent())!,
    );
    expect(restored.nodePositions).toEqual(saved.nodePositions);
    expect(restored.filters).toEqual(saved.filters);
    for (const key of ['position', 'target'])
      restored.camera[key].forEach((v: number, i: number) =>
        expect(v).toBeCloseTo(saved.camera[key][i], 5),
      );
  }).toPass();
  await page.screenshot({ path: 'artifacts/saved-view.png' });
  await page.getByRole('button', { name: 'Delete view', exact: true }).click();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('archgraph-demo-views-v1')!),
    ),
  ).toEqual([]);
});

test('demo saved view controls handle duplicate names and blocked storage', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.av-node-label')).toHaveCount(10);
  await page.getByLabel('View name', { exact: true }).fill('Overview');
  await page.getByRole('button', { name: 'Save view', exact: true }).click();
  await page.getByRole('button', { name: 'Save view', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('already exists');
  await page.screenshot({ path: 'artifacts/saved-views-demo.png' });
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new Error('Storage unavailable');
    };
  });
  await page.getByLabel('View name', { exact: true }).fill('Another');
  await page.getByRole('button', { name: 'Save view', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Storage unavailable');
});
