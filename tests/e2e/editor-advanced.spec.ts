import { test, expect, type Page } from '@playwright/test';
import { createProjectThroughWizard } from './project-wizard';

async function register(page: Page, email: string) {
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `10.70.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}` });
  await page.goto('/register');
  await page.getByLabel('Votre nom').fill('Éditeur avancé');
  await page.getByLabel('Adresse email').fill(email);
  await page.getByLabel('Mot de passe').fill('mot-de-passe-e2e-tres-long');
  await page.getByRole('button', { name: 'Créer mon espace' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}
async function createAndOpen(page: Page, name: string) {
  await createProjectThroughWizard(page, name);
  await page.getByRole('link', { name: 'Ouvrir l’éditeur →' }).click();
  await expect(page).toHaveURL(/\/editor\/[a-f0-9-]+$/);
  return page.url().split('/').pop()!;
}

test('créer un point et restaurer le brouillon sans perdre son historique', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  await register(page, `versions-${suffix}@example.com`);
  const pageId = await createAndOpen(page, `Versions E2E ${suffix}`);
  await page.locator('[data-testid="editor-canvas"] [data-node-type="hero"]').first().click();
  const title = page.getByTestId('field-title');
  const original = await title.inputValue();
  const checkpoint = page.waitForResponse((response) => response.url().includes(`/api/pages/${pageId}/checkpoint`) && response.status() === 201);
  await page.getByRole('button', { name: 'Point de restauration' }).click();
  await checkpoint;
  await title.fill(`Version deux ${suffix}`);
  const saved = page.waitForResponse((response) => response.url().includes(`/api/pages/${pageId}/document`) && response.request().method() === 'PUT' && response.status() === 200);
  await page.getByTestId('save-page').click(); await saved;
  await page.getByRole('button', { name: 'Historique', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Historique de la page' })).toBeVisible();
  const restored = page.waitForResponse((response) => response.url().includes('/restore') && response.status() === 200);
  await page.getByRole('button', { name: 'Restaurer cette version' }).first().click(); await restored;
  await expect(page.locator('[data-testid="editor-canvas"] h1').first()).toHaveText(original);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-testid="editor-canvas"] [data-node-type="hero"]').first().click();
  await expect(page.getByTestId('field-title')).toHaveValue(original);
  await page.getByRole('button', { name: 'Historique', exact: true }).click();
  await expect(page.getByText('Restauration', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('éditer à 390 px, téléverser et réutiliser un média persistant', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  await page.setViewportSize({ width: 390, height: 844 });
  await register(page, `mobile-media-${suffix}@example.com`);
  const pageId = await createAndOpen(page, `Mobile médias ${suffix}`);
  await page.locator('[data-testid="editor-canvas"] [data-node-type="hero"]').first().click();
  await expect(page.locator('.editor-right.mobile-open')).toBeVisible();
  await page.getByTestId('field-title').fill(`Titre mobile ${suffix}`);
  await page.getByRole('button', { name: 'Fermer le panneau de propriétés' }).click();
  await page.getByRole('button', { name: '☰ Blocs' }).click();
  await expect(page.locator('.editor-left.mobile-open .component-library')).toBeVisible();
  await page.locator('.component-library').getByRole('button', { name: /Image responsive avec alternative/ }).click();
  await expect(page.locator('.editor-right.mobile-open')).toBeVisible();
  const uploadResponse = page.waitForResponse((response) => response.url().includes('/assets') && response.request().method() === 'POST' && response.status() === 201);
  await page.getByLabel('Téléverser : Média').setInputFiles('tests/fixtures/pixel.png'); await uploadResponse;
  const firstSave = page.waitForResponse((response) => response.url().includes(`/api/pages/${pageId}/document`) && response.request().method() === 'PUT' && response.status() === 200);
  await firstSave;
  await page.getByRole('button', { name: 'Bibliothèque de médias' }).click();
  await expect(page.getByRole('heading', { name: 'Bibliothèque', exact: true })).toBeVisible();
  const secondSave = page.waitForResponse((response) => response.url().includes(`/api/pages/${pageId}/document`) && response.request().method() === 'PUT' && response.status() === 200);
  await page.getByRole('button', { name: 'Utiliser pixel.png', exact: true }).click();
  const assetId = await page.getByTestId('field-assetId').inputValue();
  expect(assetId).toMatch(/^[a-f0-9-]{36}$/);
  await secondSave;
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-testid="editor-canvas"] [data-node-type="image"]').first().click();
  await expect(page.getByTestId('field-assetId')).toHaveValue(assetId);
  await expect(page.locator('.editor-right.mobile-open')).toBeVisible();
  expect(errors).toEqual([]);
});
