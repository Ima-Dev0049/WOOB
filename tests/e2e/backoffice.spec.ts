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
function isolateIp(page: Page) {
  return page.setExtraHTTPHeaders({ 'x-forwarded-for': `10.60.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}` });
}
async function createProject(page: Page, name: string, type?: RegExp) {
  await createProjectThroughWizard(page, name, type ? { type } : {});
}

test('gérer un produit, un article et un module depuis le back-office', async ({ page }) => {
  const browserErrors: string[] = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  await isolateIp(page);
  await register(page, 'Boutique E2E', `boutique-${suffix}@example.com`);
  await createProject(page, `Boutique back-office ${suffix}`, /Boutique multimarque/);
  await page.getByRole('link', { name: 'Gérer les modules →' }).click();
  await page.getByRole('tab', { name: /Produits/ }).click();
  const productForm = page.locator('form.business-edit-form').first();
  await productForm.getByLabel('Nom', { exact: true }).fill(`Produit E2E ${suffix}`);
  await productForm.getByLabel('Prix', { exact: true }).fill('12.34');
  await productForm.getByLabel(/Stock/).fill('5');
  await productForm.getByLabel('Description', { exact: true }).fill('Produit créé par le parcours navigateur.');
  const productResponse = page.waitForResponse((response) => response.url().includes('/products') && response.request().method() === 'POST' && response.status() === 201);
  await productForm.getByRole('button', { name: 'Ajouter le produit' }).click();
  await productResponse;
  await expect(page.getByText(`Produit E2E ${suffix}`, { exact: true })).toBeVisible();

  await page.getByRole('tab', { name: /Modules/ }).click();
  const blogToggle = page.getByRole('checkbox', { name: /Blog & contenu/ });
  const moduleResponse = page.waitForResponse((response) => response.url().includes('/modules') && response.request().method() === 'PATCH' && response.status() === 200);
  await blogToggle.check();
  await moduleResponse;
  await expect(blogToggle).toBeChecked();

  await page.getByRole('tab', { name: /Articles/ }).click();
  const postForm = page.locator('form.business-edit-form').first();
  await postForm.getByLabel('Titre', { exact: true }).fill(`Article E2E ${suffix}`);
  await postForm.getByLabel('Résumé', { exact: true }).fill('Un article réellement enregistré.');
  await postForm.getByLabel('Contenu', { exact: true }).fill('Le contenu éditorial du test navigateur.');
  await postForm.getByRole('combobox', { name: 'Statut', exact: true }).selectOption('published');
  const postResponse = page.waitForResponse((response) => response.url().includes('/posts') && response.request().method() === 'POST' && response.status() === 201);
  await postForm.getByRole('button', { name: 'Créer l’article' }).click();
  await postResponse;
  await expect(page.getByText(`Article E2E ${suffix}`, { exact: true })).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test('ajouter un compte existant et ouvrir son espace partagé', async ({ page, browser }) => {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const projectName = `Projet partagé E2E ${suffix}`;
  const memberEmail = `membre-${suffix}@example.com`;
  await isolateIp(page);
  await register(page, 'Owner Collaboration', `owner-${suffix}@example.com`);
  await createProject(page, projectName);
  await page.getByRole('link', { name: 'Paramètres' }).click();
  await page.getByLabel('Email du compte existant').fill(memberEmail);
  const memberContext = await browser.newContext();
  const memberPage = await memberContext.newPage();
  await isolateIp(memberPage);
  await register(memberPage, 'Member Collaboration', memberEmail);
  const addResponse = page.waitForResponse((response) => response.url().includes('/members') && response.request().method() === 'POST' && response.status() === 201);
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await addResponse;
  await expect(page.getByText(memberEmail, { exact: true })).toBeVisible();
  await memberPage.goto('/dashboard/settings');
  const workspaceResponse = memberPage.waitForResponse((response) => response.url().includes('/api/workspaces/active') && response.status() === 200);
  await memberPage.getByRole('combobox', { name: 'Espace de travail actif' }).selectOption({ label: 'Espace de Owner Collaboration' });
  await workspaceResponse;
  await memberPage.getByRole('link', { name: 'Vue d’ensemble' }).click();
  await expect(memberPage.getByText(projectName, { exact: true }).first()).toBeVisible();
  await memberContext.close();
});

test('prévisualiser et appliquer l’IA démo, puis vérifier domaines et paiement non configurés', async ({ page }) => {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const generatedTitle = `Atelier céramique E2E ${suffix}`;
  await isolateIp(page);
  await register(page, 'IA E2E', `ia-${suffix}@example.com`);
  await createProject(page, `Projet IA ${suffix}`);
  await page.getByRole('link', { name: 'Ouvrir l’éditeur →' }).click();
  await expect(page).toHaveURL(/\/dashboard\/projects\/[a-f0-9-]+\/editor\/[a-f0-9-]+$/);
  const pageId = page.url().split('/').pop()!;
  await page.locator('[data-testid="editor-canvas"] [data-node-type="features"]').first().click();
  const duplicateIds = await page.locator('.editor-right [id]').evaluateAll((elements) => { const ids = elements.map((element) => element.id); return ids.filter((id, index) => ids.indexOf(id) !== index); });
  expect(duplicateIds).toEqual([]);
  await page.locator('[data-testid="editor-canvas"] [data-node-type="hero"]').first().click();
  await page.getByRole('button', { name: '✦ IA' }).click();
  await page.getByLabel('Votre consigne').fill(generatedTitle);
  const aiResponse = page.waitForResponse((response) => response.url().includes(`/api/pages/${pageId}/ai`) && response.status() === 201);
  await page.getByRole('button', { name: 'Générer une proposition' }).click();
  await aiResponse;
  await expect(page.getByText('DÉMO LOCALE', { exact: true })).toBeVisible();
  await expect(page.locator('.ai-preview h1').first()).toHaveText(generatedTitle);
  await page.getByRole('button', { name: 'Appliquer au brouillon' }).click();
  await expect(page.locator('[data-testid="editor-canvas"] h1').first()).toHaveText(generatedTitle);
  const saveResponse = page.waitForResponse((response) => response.url().includes(`/api/pages/${pageId}/document`) && response.request().method() === 'PUT' && response.status() === 200);
  await page.getByTestId('save-page').click();
  await saveResponse;
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.locator('[data-testid="editor-canvas"] h1').first()).toHaveText(generatedTitle);

  await page.getByRole('link', { name: 'Retour au projet' }).click();
  await page.getByRole('link', { name: 'Configurer les domaines →' }).click();
  await page.getByLabel('Nom de domaine').fill('www.atelier.example');
  await page.getByRole('button', { name: 'Ajouter l’intention' }).click();
  await expect(page.getByRole('status')).toContainText('domaines personnalisés ne sont pas disponibles');
  await page.getByRole('link', { name: 'Offre et utilisation' }).click();
  await expect(page.getByRole('heading', { name: 'Offre et utilisation' })).toBeVisible();
  await expect(page.getByText('Paiement externe non configuré', { exact: true })).toBeVisible();
  await expect(page.getByText('Gratuit', { exact: true }).first()).toBeVisible();
});
