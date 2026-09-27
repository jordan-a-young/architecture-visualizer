import { expect, test } from '@playwright/test';
test('nested groups preserve edge inspection, positions and saved collapse state', async ({
  page,
}) => {
  await page.goto('/interaction-test.html?groups&saved');
  await expect(page.locator('.av-node-label')).toHaveCount(3);
  await page.getByText('Browse nodes (3)', { exact: true }).click();
  await page.getByText('Groups (2)', { exact: true }).click();
  await page
    .getByRole('button', { name: 'Collapse Services', exact: false })
    .click();
  await page
    .getByRole('button', { name: 'Collapse Domain', exact: true })
    .click();
  await expect(page.locator('.av-node-label')).toHaveCount(2);
  await expect(page.locator('.av-edge-label')).toHaveCount(1);
  await page
    .getByRole('button', {
      name: 'Inspect relationship: publishes',
      exact: true,
    })
    .click();
  await expect(
    page
      .getByRole('complementary')
      .getByRole('button', { name: 'Database', exact: true }),
  ).toBeVisible();
  await page.getByLabel('View name', { exact: true }).fill('Collapsed');
  await page.getByRole('button', { name: 'Save view', exact: true }).click();
  await page.locator('.av-node-label').filter({ hasText: 'Domain' }).click();
  await expect(page.locator('.av-node-label')).toHaveCount(3);
  await expect(
    page.locator('.av-node-label').filter({ hasText: 'Services' }),
  ).toHaveCount(1);
  await page.getByRole('button', { name: 'Restore view', exact: true }).click();
  await expect(page.locator('.av-node-label')).toHaveCount(2);
  await page.screenshot({ path: 'artifacts/collapsed-groups.png' });
});
test('controlled collapse can be declined and mobile group controls stay reachable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/interaction-test.html?groups&controlled&reject');
  await expect(page.locator('.av-node-label')).toHaveCount(3);
  await page.getByText('Browse nodes (3)', { exact: true }).click();
  await page.getByText('Groups (2)', { exact: true }).click();
  await page
    .getByRole('button', { name: 'Collapse Domain', exact: true })
    .click();
  await expect(page.locator('.av-node-label')).toHaveCount(3);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});
