import { test, expect, type Page } from '@playwright/test';
import { createProjectThroughWizard } from './project-wizard';

async function createEditorPage(page: Page, suffix: string) {
  await page.goto('/register');
  await page.getByLabel('Votre nom').fill('Test versions');
  await page.getByLabel('Adresse email').fill(`versions-${suffix}@example.com`);
  await page.getByLabel('Mot de passe').fill('mot-de-passe-versions-tres-long');
  await page.getByRole('button', { name: 'Créer mon espace' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await createProjectThroughWizard(page, `Projet versions ${suffix}`);
  await page.getByRole('link', { name: 'Ouvrir l’éditeur →' }).click();
  await expect(page).toHaveURL(/\/editor\/[a-f0-9-]+$/);
  return page.url().split('/').pop()!;
}

test('créer un point de restauration puis retrouver son contenu après une modification', async ({ page }) => {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const originalTitle = `Version originale ${suffix}`;
  const changedTitle = `Modification à remplacer ${suffix}`;
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `10.44.0.${Math.floor(Math.random() * 200) + 1}` });
  const pageId = await createEditorPage(page, suffix);
  await page.locator('[data-testid="editor-canvas"] [data-node-type="hero"]').first().click();
  await page.getByTestId('field-title').fill(originalTitle);

  let responsePromise = page.waitForResponse((response) => response.url().includes(`/api/pages/${pageId}/document`) && response.request().method() === 'PUT' && response.status() === 200);
  await page.getByTestId('save-page').click();
  await responsePromise;
  responsePromise = page.waitForResponse((response) => response.url().includes(`/api/pages/${pageId}/checkpoint`) && response.request().method() === 'POST' && response.status() === 201);
  await page.getByRole('button', { name: 'Point de restauration' }).click();
  await responsePromise;

  await page.getByTestId('field-title').fill(changedTitle);
  responsePromise = page.waitForResponse((response) => response.url().includes(`/api/pages/${pageId}/document`) && response.request().method() === 'PUT' && response.status() === 200);
  await page.getByTestId('save-page').click();
  await responsePromise;
  await page.getByRole('button', { name: 'Historique', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Historique de la page' })).toBeVisible();
  await expect(page.getByText('Point manuel', { exact: true })).toBeVisible();
  responsePromise = page.waitForResponse((response) => response.url().includes(`/api/pages/${pageId}/versions/`) && response.url().endsWith('/restore') && response.request().method() === 'POST' && response.status() === 200);
  await page.getByRole('button', { name: 'Restaurer cette version' }).first().click();
  await responsePromise;
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByTestId('field-title')).toHaveValue(originalTitle);
  await expect(page.locator('[data-testid="editor-canvas"] h1').first()).toHaveText(originalTitle);

  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-testid="editor-canvas"] [data-node-type="hero"]').first().click();
  await expect(page.getByTestId('field-title')).toHaveValue(originalTitle);
});
