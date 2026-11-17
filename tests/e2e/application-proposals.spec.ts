import { test, expect, type Page } from '@playwright/test';
import { createProjectThroughWizard } from './project-wizard';
import { expectApplicationAccessible } from './application-audit';

async function register(page: Page, email: string) {
  await page.goto('/register');
  await page.getByLabel('Votre nom').fill('Direction E2E');
  await page.getByLabel('Adresse email').fill(email);
  await page.getByLabel('Mot de passe').fill('mot-de-passe-e2e-tres-long');
  await page.getByRole('button', { name: 'Créer mon espace' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test('une proposition de modèle est prévisualisée, ignorée puis appliquée sans toucher au reste', async ({ page }) => {
  test.setTimeout(120_000);
  const browserErrors: string[] = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `10.86.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}` });
  await register(page, `model-proposal-${suffix}@example.com`);
  await createProjectThroughWizard(page, `Proposition ${suffix}`);
  await page.getByRole('link', { name: 'Modèle d’application →' }).click();
  const setupResponse = page.waitForResponse((response) => response.url().includes('/application') && response.request().method() === 'PUT' && response.status() === 200);
  await page.getByRole('button', { name: 'Initialiser un portail scolaire' }).click();
  await setupResponse;
  await expect(page.getByRole('heading', { name: 'Portail scolaire', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Personnaliser le modèle', exact: true }).click();
  const editor = page.locator('.application-model-editor');
  const preview = page.getByRole('complementary', { name: 'Aperçu du brouillon de modèle', exact: true });
  const proposalPreview = editor.getByRole('region', { name: 'Proposition prévisualisée' });
  await expect(editor.getByRole('button', { name: 'Appliquer le brouillon', exact: true })).toBeDisabled();

  // A field label already present on the object is refused instead of being added twice.
  await editor.getByRole('combobox', { name: 'Type de proposition', exact: true }).selectOption('tel');
  await editor.getByRole('combobox', { name: 'Objet de la proposition', exact: true }).selectOption('dossiers');
  const refusedResponse = page.waitForResponse((response) => response.url().endsWith('/application/proposals') && response.request().method() === 'POST');
  await editor.getByRole('button', { name: 'Prévisualiser la proposition', exact: true }).click();
  expect((await refusedResponse).status()).toBe(409);
  await expect(editor.getByRole('alert')).toContainText('Un champ « Téléphone » existe déjà sur Dossiers.');
  await expect(editor.getByRole('region', { name: 'Proposition prévisualisée' })).toHaveCount(0);

  // Guided request: a date field on the applications, with a custom label.
  await editor.getByRole('combobox', { name: 'Type de proposition', exact: true }).selectOption('suivi-date');
  await editor.getByRole('combobox', { name: 'Objet de la proposition', exact: true }).selectOption('dossiers');
  await editor.getByRole('textbox', { name: 'Libellé proposé', exact: true }).fill(`Relance ${suffix}`);
  const proposalResponse = page.waitForResponse((response) => response.url().endsWith('/application/proposals') && response.request().method() === 'POST' && response.status() === 200);
  await editor.getByRole('button', { name: 'Prévisualiser la proposition', exact: true }).click();
  await proposalResponse;
  await expect(proposalPreview).toBeVisible();
  await expect(proposalPreview.getByRole('heading', { name: `Champ « Relance ${suffix} »`, exact: true })).toBeVisible();
  await expect(proposalPreview).toContainText('Aucun enregistrement existant n’est réécrit');
  await expect(proposalPreview).toContainText('Colonne ajoutée');
  // Previewing alone changes neither the draft nor the persisted model.
  await expect(editor.getByRole('button', { name: 'Appliquer le brouillon', exact: true })).toBeDisabled();
  await page.screenshot({ path: 'test-results/application-proposals-desktop.png', fullPage: true });

  await proposalPreview.getByRole('button', { name: 'Ignorer la proposition', exact: true }).click();
  await expect(proposalPreview).toHaveCount(0);
  await expect(editor.getByRole('status')).toContainText('Proposition ignorée');
  await expect(editor.getByRole('button', { name: 'Appliquer le brouillon', exact: true })).toBeDisabled();

  const secondResponse = page.waitForResponse((response) => response.url().endsWith('/application/proposals') && response.request().method() === 'POST' && response.status() === 200);
  await editor.getByRole('button', { name: 'Prévisualiser la proposition', exact: true }).click();
  await secondResponse;
  await expect(proposalPreview).toBeVisible();
  await proposalPreview.getByRole('button', { name: 'Appliquer la proposition au brouillon', exact: true }).click();
  await expect(proposalPreview).toHaveCount(0);
  await expect(editor.getByRole('status')).toContainText('Proposition appliquée au brouillon');
  await expect(preview).toContainText(`+ Relance ${suffix}`);
  await expect(editor.getByRole('button', { name: 'Appliquer le brouillon', exact: true })).toBeEnabled();
  // Once the draft is dirty, a new proposal is blocked to protect unsaved edits.
  await expect(editor.getByRole('button', { name: 'Prévisualiser la proposition', exact: true })).toBeDisabled();
  await expect(editor).toContainText('Enregistrez ou annulez le brouillon actuel avant de demander une proposition');

  const saveResponse = page.waitForResponse((response) => /\/application$/.test(new URL(response.url()).pathname) && response.request().method() === 'PUT' && response.status() === 200);
  await editor.getByRole('button', { name: 'Appliquer le brouillon', exact: true }).click();
  await saveResponse;
  await expect(editor).toHaveCount(0);

  // The saved model exposes the new field in the record form and keeps the seeded statuses.
  // The panel refetches after saving, so wait for the new version before switching tabs.
  await expect(page.getByText('Modèle v2 · Rôle : Propriétaire', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^Dossiers/ }).click();
  await expect(page.getByRole('heading', { name: 'Dossiers', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Ajouter : Dossier', exact: true }).click();
  const form = page.locator('.application-record-form:not(.application-model-editor)');
  await expect(form.getByLabel(`Relance ${suffix}`, { exact: true })).toBeVisible();
  await expect(form.getByRole('textbox', { name: 'Nom complet', exact: true })).toBeVisible();
  await expect(form.getByRole('combobox', { name: 'Filière', exact: true })).toBeVisible();
  await expectApplicationAccessible(page);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/application-proposals-mobile.png', fullPage: true });
  await expect(browserErrors).toEqual([]);
});
