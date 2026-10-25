import { test, expect } from '@playwright/test';

test('le site marketing et les tarifs sont accessibles anonymement', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Woob/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Votre activité.');
  await expect(page.locator('.marketing-lead')).toContainText('restaurant, école, université ou entreprise');
  await expect(page.locator('.hero-showcase')).toContainText('24 réservations.');
  await expect(page.locator('.feature-bento')).toContainText('Des rôles pour chaque équipe');
  await page.screenshot({ path: 'test-results/management-home-desktop.png', fullPage: true, animations: 'disabled' });
  await expect(page.getByRole('link', { name: /King Food/ })).toHaveAttribute('href', '/demos/king-food');
  await expect(page.getByRole('link', { name: /Atelier Ligne/ })).toHaveAttribute('href', '/demos/atelier-ligne');
  await expect(page.getByRole('link', { name: /Studio Cap/ })).toHaveAttribute('href', '/demos/studio-cap');
  await expect(page.getByText('Maison Miel', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Atelier Noma', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Forme', { exact: true })).toHaveCount(0);
  await page.goto('/pricing');
  await expect(page.getByRole('heading', { name: 'Gratuit', exact: true })).toBeVisible();
  await expect(page.getByText('Aucun débit n’est simulé ici.', { exact: false })).toBeVisible();
});
