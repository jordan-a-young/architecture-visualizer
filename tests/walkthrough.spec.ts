import { expect, test } from '@playwright/test';
test('walkthrough chooses branches, revisits nodes, uses actual history and respects filters', async ({
  page,
}) => {
  await page.goto('/interaction-test.html?walkthrough');
  await page.locator('[data-node-id="a"]').click();
  await page
    .getByRole('button', { name: 'Start walkthrough', exact: true })
    .click();
  const walk = page.getByLabel('Connection walkthrough', { exact: true });
  await walk.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Database', exact: true }),
  ).toBeVisible();
  await walk.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(
    walk.getByRole('group', { name: 'Choose next relationship' }),
  ).toBeVisible();
  await walk.getByRole('button', { name: 'loops → Database · bb' }).click();
  await expect(
    walk.getByRole('button', { name: '3. Database', exact: true }),
  ).toBeVisible();
  await walk.getByRole('button', { name: 'Previous', exact: true }).click();
  await expect(
    walk.getByRole('button', { name: '3. Database', exact: true }),
  ).toHaveCount(0);
  await walk.getByRole('button', { name: 'Next', exact: true }).click();
  await page
    .getByRole('button', { name: 'Toggle filter', exact: true })
    .click();
  await expect(
    walk.getByRole('button', { name: /publishes → Independent/ }),
  ).toBeDisabled();
  await page
    .getByRole('button', { name: 'Toggle filter', exact: true })
    .click();
  await walk.getByRole('button', { name: /publishes → Independent/ }).click();
  await expect(
    walk.getByRole('button', { name: 'Next', exact: true }),
  ).toBeDisabled();
  await walk
    .getByRole('button', { name: '1. Custom node', exact: true })
    .click();
  await expect(
    walk.getByRole('button', { name: 'Previous', exact: true }),
  ).toBeDisabled();
  await page.screenshot({ path: 'artifacts/walkthrough.png' });
  await walk
    .getByRole('button', { name: 'Reset walkthrough', exact: true })
    .click();
  await expect(walk).toHaveCount(0);
});

test('mobile controlled walkthrough remains operable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/interaction-test.html?walkthrough&controlled');
  await page.locator('[data-node-id="a"]').click();
  await page
    .getByRole('button', { name: 'Start walkthrough', exact: true })
    .click();
  const walk = page.getByLabel('Connection walkthrough', { exact: true });
  await walk.getByRole('button', { name: 'Next', exact: true }).click();
  await walk.getByRole('button', { name: 'Next', exact: true }).click();
  await walk.getByRole('button', { name: /retries → Custom node/ }).click();
  await expect(
    walk.getByRole('button', { name: '3. Custom node', exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'artifacts/walkthrough-mobile.png' });
});
