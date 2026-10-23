import { test, expect, type Page } from '@playwright/test';
import { createProjectThroughWizard } from './project-wizard';

async function register(page: Page, email: string) {
  await page.goto('/register');
  await page.getByLabel('Votre nom').fill('Test mobile');
  await page.getByLabel('Adresse email').fill(email);
  await page.getByLabel('Mot de passe').fill('mot-de-passe-mobile-tres-long');
  await page.getByRole('button', { name: 'Créer mon espace' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test('éditer, ouvrir les panneaux et sauvegarder sur un écran mobile', async ({ page }) => {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const expectedTitle = `Titre mobile ${suffix}`;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `10.43.0.${Math.floor(Math.random() * 200) + 1}` });
  await register(page, `mobile-${suffix}@example.com`);
  await createProjectThroughWizard(page, `Projet mobile ${suffix}`);
  await page.getByRole('link', { name: 'Ouvrir l’éditeur →' }).click();
  await expect(page).toHaveURL(/\/editor\/[a-f0-9-]+$/);
  const pageId = page.url().split('/').pop()!;

  const saveButton = page.getByTestId('save-page');
  await expect(saveButton).toBeVisible();
  await page.locator('[data-testid="editor-canvas"] [data-node-type="hero"]').first().click();
  await expect(page.getByTestId('field-title')).toBeVisible();
  await page.getByTestId('field-title').fill(expectedTitle);
  await page.getByRole('button', { name: 'Fermer le panneau de propriétés' }).click();

  await page.getByRole('button', { name: '☰ Blocs' }).click();
  await expect(page.getByRole('heading', { name: 'Composants' })).toBeVisible();
  await page.getByRole('button', { name: 'Fermer le panneau de blocs' }).click();
  await page.getByTitle('Mobile', { exact: true }).click();
  await expect(page.getByTestId('editor-canvas')).toHaveClass(/viewport-mobile/);

  const saveResponse = page.waitForResponse((response) => response.url().includes(`/api/pages/${pageId}/document`) && response.request().method() === 'PUT' && response.status() === 200);
  await saveButton.click();
  await saveResponse;
  await expect(page.locator('.save-indicator')).toHaveClass(/saved/);
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByTestId('save-page')).toBeVisible();
  await page.locator('[data-testid="editor-canvas"] [data-node-type="hero"]').first().click();
  await expect(page.getByTestId('field-title')).toHaveValue(expectedTitle);

  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(hasHorizontalOverflow).toBe(false);
});
