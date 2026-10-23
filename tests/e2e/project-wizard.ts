import { expect, type Page } from '@playwright/test';

export async function createProjectThroughWizard(page: Page, name: string, options: { type?: RegExp; brief?: string } = {}) {
  await page.getByRole('button', { name: /Nouveau projet/ }).first().click();
  await page.getByLabel('Nom du projet').fill(name);
  if (options.type) await page.getByRole('radio', { name: options.type }).check();
  await page.getByRole('button', { name: /Passer directement à la description/ }).click();
  if (options.brief) await page.getByLabel(/Description libre/).fill(options.brief);
  const previewResponse = page.waitForResponse((response) => response.url().includes('/project-preview') && response.request().method() === 'POST' && response.status() === 201);
  await page.getByRole('button', { name: 'Générer l’aperçu →' }).click();
  await previewResponse;
  await expect(page.getByTestId('catalog-preview')).toBeVisible();
  const createResponse = page.waitForResponse((response) => response.url().includes('/projects') && response.request().method() === 'POST' && response.status() === 201);
  await page.getByRole('button', { name: 'Créer le projet →' }).click();
  await createResponse;
  await expect(page).toHaveURL(/\/dashboard\/projects\/[a-f0-9-]+$/);
}
