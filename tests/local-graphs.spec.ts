import { expect, test } from '@playwright/test';

test('local JSON is validated without network or persistence and dataset switching resets view state', async ({
  page,
}) => {
  const errors: string[] = [];
  const unexpectedRequests: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: 'Download PNG', exact: true }),
  ).toBeEnabled();
  page.on('request', (request) => unexpectedRequests.push(request.url()));
  const data = {
    version: '1.0',
    groups: [],
    nodes: [
      { id: 'private-ui', label: 'Local workspace', type: 'custom-ui' },
      { id: 'private-data', label: 'Local database', type: 'database' },
    ],
    edges: [
      { source: 'private-ui', target: 'private-data', type: 'custom-call' },
    ],
  };
  const file = page.getByLabel('Load graph JSON', { exact: true });
  const storageBefore = await page.evaluate(() => JSON.stringify(localStorage));
  await file.setInputFiles({
    name: 'local-example.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(data)),
  });
  await expect(
    page.getByRole('heading', { name: 'local-example.json', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Node type', { exact: true })).toContainText(
    'custom-ui',
  );
  await page.getByText('Browse nodes (2)', { exact: true }).click();
  await page
    .locator('.av-node-list')
    .getByRole('button', { name: 'Local workspace', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Local workspace', exact: true }),
  ).toBeVisible();
  await page.getByLabel('Node type', { exact: true }).selectOption('database');
  await page
    .getByRole('combobox', { name: 'Dataset', exact: true })
    .selectOption('commerce');
  await expect(
    page.getByRole('heading', { name: 'Commerce Platform', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Node type', { exact: true })).toHaveValue(
    'all',
  );
  await expect(
    page.getByText('Browse nodes (10)', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('combobox', { name: 'Dataset', exact: true })
    .selectOption({ label: 'local-example.json' });
  await expect(
    page.getByRole('heading', { name: 'Explore your system', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Browse nodes (2)', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Save view', exact: true }),
  ).toHaveCount(0);
  for (const invalid of [
    '{',
    JSON.stringify({
      ...data,
      edges: [{ source: 'missing', target: 'private-data' }],
    }),
  ]) {
    await file.setInputFiles({
      name: 'invalid.json',
      mimeType: 'application/json',
      buffer: Buffer.from(invalid),
    });
    await expect(page.getByRole('alert')).toContainText('Could not load graph');
    await expect(
      page.getByRole('heading', { name: 'local-example.json', exact: true }),
    ).toBeVisible();
  }
  expect(await page.evaluate(() => JSON.stringify(localStorage))).toBe(
    storageBefore,
  );
  expect(unexpectedRequests).toEqual([]);
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'artifacts/local-graph-import.png' });
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Commerce Platform', exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole('combobox', { name: 'Dataset', exact: true })
      .locator('option'),
  ).toHaveCount(1);
});
