import { test, expect } from '@playwright/test';
import { createProjectThroughWizard } from './project-wizard';

const pixelPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

test('téléverser un média, le réutiliser depuis la bibliothèque et le retrouver après sauvegarde', async ({ page }) => {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `10.45.0.${Math.floor(Math.random() * 200) + 1}` });
  await page.goto('/register');
  await page.getByLabel('Votre nom').fill('Test médias');
  await page.getByLabel('Adresse email').fill(`media-${suffix}@example.com`);
  await page.getByLabel('Mot de passe').fill('mot-de-passe-media-tres-long');
  await page.getByRole('button', { name: 'Créer mon espace' }).click();
  await createProjectThroughWizard(page, `Projet média ${suffix}`);
  await page.getByRole('link', { name: 'Ouvrir l’éditeur →' }).click();
  await expect(page).toHaveURL(/\/editor\/[a-f0-9-]+$/);
  const pageId = page.url().split('/').pop()!;
  await page.locator('[data-testid="editor-canvas"] [data-node-type="hero"]').first().click();
  await page.getByRole('button', { name: 'Bibliothèque de médias' }).click();
  await expect(page.getByRole('dialog', { name: 'Bibliothèque' })).toBeVisible();

  const uploadResponse = page.waitForResponse((response) => /\/api\/projects\/[a-f0-9-]+\/assets$/.test(new URL(response.url()).pathname) && response.request().method() === 'POST' && response.status() === 201);
  await page.getByLabel('Téléverser dans la bibliothèque').setInputFiles({ name: `pixel-${suffix}.png`, mimeType: 'image/png', buffer: pixelPng });
  await uploadResponse;
  const assetButton = page.getByRole('button', { name: `Utiliser pixel-${suffix}.png` });
  await expect(assetButton).toBeVisible();
  await assetButton.click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const assetField = page.getByTestId('field-imageAssetId');
  const assetId = await assetField.inputValue();
  expect(assetId).toMatch(/^[a-f0-9-]+$/);
  await page.getByTestId('field-imageAlt').fill('Pixel réutilisé dans le hero');

  await page.getByRole('button', { name: 'Bibliothèque de médias' }).click();
  await page.getByPlaceholder('Nom ou texte alternatif').fill(`pixel-${suffix}`);
  await expect(page.getByRole('button', { name: `Utiliser pixel-${suffix}.png` })).toBeVisible();
  await page.getByRole('button', { name: 'Fermer', exact: true }).click();
  const saveResponse = page.waitForResponse((response) => response.url().includes(`/api/pages/${pageId}/document`) && response.request().method() === 'PUT' && response.status() === 200);
  await page.getByTestId('save-page').click();
  await saveResponse;
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-testid="editor-canvas"] [data-node-type="hero"]').first().click();
  await expect(page.getByTestId('field-imageAssetId')).toHaveValue(assetId);
  await expect(page.getByTestId('field-imageAlt')).toHaveValue('Pixel réutilisé dans le hero');
  const mediaResponse = await page.request.get(`/media/${assetId}`);
  expect(mediaResponse.status()).toBe(200);
  expect(mediaResponse.headers()['content-type']).toBe('image/png');
});
