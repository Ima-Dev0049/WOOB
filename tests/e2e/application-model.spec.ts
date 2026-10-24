import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createProjectThroughWizard } from './project-wizard';

async function register(page: Page, email: string) {
  await page.goto('/register');
  await page.getByLabel('Votre nom').fill('Direction E2E');
  await page.getByLabel('Adresse email').fill(email);
  await page.getByLabel('Mot de passe').fill('mot-de-passe-e2e-tres-long');
  await page.getByRole('button', { name: 'Créer mon espace' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test('le modèle géré exécute un portail scolaire avec relations, processus et routes déduites', async ({ page }) => {
  const browserErrors: string[] = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  page.on('dialog', (dialog) => void dialog.accept());
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `10.81.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}` });
  await register(page, `application-${suffix}@example.com`);
  await createProjectThroughWizard(page, `Portail scolaire ${suffix}`);
  await page.getByRole('link', { name: 'Modèle d’application →' }).click();
  await expect(page.getByRole('heading', { name: 'Application gérée', exact: true })).toBeVisible();

  const setupResponse = page.waitForResponse((response) => response.url().includes('/application') && response.request().method() === 'PUT' && response.status() === 200);
  await page.getByRole('button', { name: 'Initialiser un portail scolaire' }).click();
  await setupResponse;
  await expect(page.getByRole('heading', { name: 'Portail scolaire', exact: true })).toBeVisible();
  await expect(page.locator('.application-runtime-note')).toContainText('Aucun backend ni schéma SQL généré par site.');

  await page.getByRole('button', { name: 'Ajouter : Filière', exact: true }).click();
  let form = page.locator('.application-record-form');
  await form.getByRole('textbox', { name: 'Nom de la filière', exact: true }).fill(`Informatique ${suffix}`);
  await form.getByRole('textbox', { name: 'Code', exact: true }).fill('INFO-E2E');
  await form.getByRole('textbox', { name: 'Description', exact: true }).fill('Filière créée par le moteur applicatif commun.');
  let createResponse = page.waitForResponse((response) => response.url().includes('/application/objects/filieres') && response.request().method() === 'POST' && response.status() === 201);
  await form.getByRole('button', { name: 'Créer l’enregistrement' }).click();
  await createResponse;
  await expect(page.locator('.application-table tbody')).toContainText(`Informatique ${suffix}`);

  await page.getByRole('button', { name: /^Dossiers/ }).click();
  await page.getByRole('button', { name: 'Ajouter : Dossier', exact: true }).click();
  form = page.locator('.application-record-form');
  const student = `Étudiant E2E ${suffix}`;
  await form.getByRole('textbox', { name: 'Nom complet', exact: true }).fill(student);
  await form.getByRole('textbox', { name: 'Email', exact: true }).fill(`etudiant-${suffix}@example.com`);
  await form.getByRole('textbox', { name: 'Téléphone', exact: true }).fill('+229 01 02 03 04');
  await form.getByRole('combobox', { name: 'Filière', exact: true }).selectOption({ label: `Informatique ${suffix}` });
  await form.getByRole('textbox', { name: 'Motivation', exact: true }).fill('Vérifier le parcours réel du modèle géré.');
  createResponse = page.waitForResponse((response) => response.url().includes('/application/objects/dossiers') && response.request().method() === 'POST' && response.status() === 201);
  await form.getByRole('button', { name: 'Créer l’enregistrement' }).click();
  await createResponse;
  const row = page.locator('.application-table tbody tr').filter({ hasText: student });
  await expect(row).toBeVisible();
  await expect(row).toContainText('Reçu');
  await expect(row).toContainText(`Informatique ${suffix}`);

  await page.getByRole('button', { name: `Modifier : ${student}`, exact: true }).click();
  form = page.locator('.application-record-form');
  await form.getByRole('textbox', { name: 'Téléphone', exact: true }).fill('+229 97 00 00 00');
  const updateResponse = page.waitForResponse((response) => response.url().includes(`/application/objects/dossiers/`) && response.request().method() === 'PATCH' && response.status() === 200);
  await form.getByRole('button', { name: 'Enregistrer les modifications' }).click();
  await updateResponse;
  await expect(row).toContainText('+229 97 00 00 00');

  const reviewResponse = page.waitForResponse((response) => response.url().includes('/actions/mettre-en-revue') && response.request().method() === 'POST' && response.status() === 200);
  await page.getByRole('button', { name: `Mettre en revue : ${student}`, exact: true }).click();
  await reviewResponse;
  await expect(row).toContainText('En revue');
  const acceptResponse = page.waitForResponse((response) => response.url().includes('/actions/accepter') && response.request().method() === 'POST' && response.status() === 200);
  await page.getByRole('button', { name: `Accepter : ${student}`, exact: true }).click();
  await acceptResponse;
  await expect(row).toContainText('Accepté');
  await page.screenshot({ path: 'test-results/application-model-desktop.png' });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  const search = page.getByRole('textbox', { name: 'Rechercher dans Dossiers' });
  await search.fill('aucun-dossier-possible');
  await expect(page.getByText('Aucun enregistrement ne correspond à ces critères.', { exact: true })).toBeVisible();
  await search.fill(student);
  await expect(row).toBeVisible();

  await page.getByRole('button', { name: /Routes & droits/ }).click();
  await expect(page.getByRole('heading', { name: 'Plan d’exécution et permissions' })).toBeVisible();
  const acceptRoute = page.locator('.application-route-list article').filter({ hasText: 'Accepter : Dossier' });
  await expect(acceptRoute).toContainText('Secrétariat');
  await expect(acceptRoute).toContainText('dossiers.actions.accepter');
  await expect(page.getByText('Aucune API publique, clé d’accès, redirection personnalisée ou publication de ces objets n’est activée dans ce lot.', { exact: false })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: /^Dossiers/ }).click();
  await expect(row).toBeVisible();
  const dimensions = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1);
  await page.screenshot({ path: 'test-results/application-model-mobile.png', fullPage: true, animations: 'disabled' });
  expect(browserErrors).toEqual([]);
});
