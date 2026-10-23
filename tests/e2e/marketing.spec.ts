import { test, expect } from '@playwright/test';

test('le site marketing et les tarifs sont accessibles anonymement', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Woob/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Votre savoir-faire.');
  await page.goto('/pricing');
  await expect(page.getByRole('heading', { name: 'Gratuit', exact: true })).toBeVisible();
  await expect(page.getByText('Aucun débit n’est simulé ici.', { exact: false })).toBeVisible();
});
