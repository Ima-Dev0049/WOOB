import { test, expect, type Page } from '@playwright/test';
import { createProjectThroughWizard } from './project-wizard';

async function register(page: Page, name: string, email: string) {
  await page.goto('/register');
  await page.getByLabel('Votre nom').fill(name);
  await page.getByLabel('Adresse email').fill(email);
  await page.getByLabel('Mot de passe').fill('mot-de-passe-e2e-tres-long');
  await page.getByRole('button', { name: 'Créer mon espace' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test('éditer un titre, sauvegarder, actualiser, publier et isoler les comptes', async ({ page, browser }) => {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const expectedTitle = `Titre E2E persistant ${suffix}`;
  const ipSuffix = Math.floor(Math.random() * 200) + 1;
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `10.42.0.${ipSuffix}` });
  await register(page, 'Camille E2E', `camille-${suffix}@example.com`);
  await createProjectThroughWizard(page, `Projet E2E ${suffix}`);
  const projectId = page.url().split('/').pop()!;
  await page.getByRole('link', { name: 'Ouvrir l’éditeur →' }).click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/projects/${projectId}/editor/[a-f0-9-]+$`));
  const pageId = page.url().split('/').pop()!;

  await page.locator('[data-testid="editor-canvas"] [data-node-type="hero"]').first().click();
  const titleField = page.getByTestId('field-title');
  await expect(titleField).toBeVisible();
  await titleField.fill(expectedTitle);
  const saveResponse = page.waitForResponse((response) => response.url().includes(`/api/pages/${pageId}/document`) && response.request().method() === 'PUT' && response.status() === 200);
  await page.getByTestId('save-page').click();
  await saveResponse;
  await expect(page.locator('.save-indicator')).toHaveClass(/saved/);

  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-testid="editor-canvas"] [data-node-type="hero"]').first().click();
  await expect(page.getByTestId('field-title')).toHaveValue(expectedTitle);
  await expect(page.locator('[data-testid="editor-canvas"] h1').first()).toHaveText(expectedTitle);

  const publishResponse = page.waitForResponse((response) => response.url().includes(`/api/projects/${projectId}/publish`) && response.request().method() === 'POST' && response.status() === 201);
  await page.getByRole('button', { name: 'Publier', exact: true }).click();
  const published = await (await publishResponse).json() as { url: string };
  const anonymous = await browser.newContext();
  const publicPage = await anonymous.newPage();
  await publicPage.goto(`http://127.0.0.1:3000${published.url}`);
  await expect(publicPage.locator('h1').first()).toHaveText(expectedTitle);

  const outsider = await browser.newContext({ extraHTTPHeaders: { 'x-forwarded-for': `10.42.1.${ipSuffix}` } });
  const otherPage = await outsider.newPage();
  await register(otherPage, 'Autre compte', `autre-${suffix}@example.com`);
  const crossAccess = await otherPage.evaluate(async ({ projectId: id, pageId: currentPageId }) => {
    const read = await fetch(`/api/projects/${id}`);
    const csrf = document.cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith('woob_csrf='))?.slice('woob_csrf='.length) || '';
    const write = await fetch(`/api/pages/${currentPageId}/document`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-csrf-token': decodeURIComponent(csrf) }, body: JSON.stringify({ baseRevision: 0, document: {} }) });
    return { read: read.status, write: write.status };
  }, { projectId, pageId });
  expect(crossAccess.read).toBe(404);
  expect(crossAccess.write).toBe(404);
});
