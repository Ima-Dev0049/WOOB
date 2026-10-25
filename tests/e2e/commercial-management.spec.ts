import { test, expect, type Page } from '@playwright/test';
import { createProjectThroughWizard } from './project-wizard';
import { expectApplicationAccessible } from './application-audit';

async function register(page: Page, email: string) {
  await page.goto('/register');
  await page.getByLabel('Votre nom').fill('Direction Commerciale');
  await page.getByLabel('Adresse email').fill(email);
  await page.getByLabel('Mot de passe').fill('mot-de-passe-e2e-tres-long');
  await page.getByRole('button', { name: 'Créer mon espace' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test('la gestion commerciale exécute clients, opportunités et validation de la conclusion', async ({ page }) => {
  test.setTimeout(120_000);
  const browserErrors: string[] = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  page.on('dialog', (dialog) => void dialog.accept());
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `10.92.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}` });
  await register(page, `commercial-${suffix}@example.com`);
  await createProjectThroughWizard(page, `Entreprise gérée ${suffix}`);
  await page.getByRole('link', { name: 'Modèle d’application →' }).click();
  await expect(page.getByRole('heading', { name: 'Choisissez votre activité', exact: true })).toBeVisible();
  await expect(page.locator('.application-template-list article')).toHaveCount(4);
  await expect(page.getByRole('heading', { name: 'Gestion commerciale', exact: true })).toBeVisible();
  const setupResponse = page.waitForResponse((response) => response.url().includes('/application') && response.request().method() === 'PUT' && response.status() === 200);
  await page.getByRole('button', { name: 'Initialiser la gestion commerciale', exact: true }).click();
  await setupResponse;
  await expect(page.getByRole('heading', { name: 'Gestion commerciale', exact: true })).toBeVisible();
  await expect(page.locator('.application-runtime-note')).toContainText('Modèle v1');

  const form = page.locator('.application-record-form:not(.application-model-editor)');
  const client = `Entreprise ${suffix}`;
  await page.getByRole('button', { name: 'Ajouter : Client', exact: true }).click();
  await form.getByRole('textbox', { name: 'Nom de l’entreprise', exact: true }).fill(client);
  await form.getByRole('textbox', { name: 'Contact principal', exact: true }).fill('Awa Mensah');
  await form.getByRole('textbox', { name: 'Email', exact: true }).fill(`contact-${suffix}@example.com`);
  await form.getByRole('textbox', { name: 'Téléphone', exact: true }).fill('+229 01 02 03 04');
  await form.getByRole('combobox', { name: 'Segment', exact: true }).selectOption('grand-compte');
  await form.getByRole('textbox', { name: 'Notes', exact: true }).fill('Client historique.');
  const createClient = page.waitForResponse((response) => response.url().includes('/application/objects/clients') && response.request().method() === 'POST' && response.status() === 201);
  await form.getByRole('button', { name: 'Créer l’enregistrement' }).click();
  await createClient;
  await expect(page.locator('.application-table tbody tr').filter({ hasText: client })).toContainText('Grand compte');

  await page.getByRole('button', { name: /^Opportunités/ }).click();
  await page.getByRole('button', { name: 'Ajouter : Opportunité', exact: true }).click();
  const opportunity = `Portail client ${suffix}`;
  await form.getByRole('textbox', { name: 'Nom de l’opportunité', exact: true }).fill(opportunity);
  await form.getByRole('combobox', { name: 'Client', exact: true }).selectOption({ label: client });
  await form.getByRole('spinbutton', { name: /^Budget estimé \(€\)/ }).fill('12500.5');
  await form.getByRole('textbox', { name: 'Échéance prévisionnelle', exact: true }).fill('2027-01-15');
  await form.getByRole('textbox', { name: 'Notes', exact: true }).fill('Proposition à valider.');
  const createOpportunity = page.waitForResponse((response) => response.url().includes('/application/objects/opportunites') && response.request().method() === 'POST' && response.status() === 201);
  await form.getByRole('button', { name: 'Créer l’enregistrement' }).click();
  await createOpportunity;
  const row = page.locator('.application-table tbody tr').filter({ hasText: opportunity });
  await expect(row).toContainText('Nouvelle');
  await expect(row).toContainText(client);
  await expect(row).toContainText('12500.5');

  async function runAction(label: string, key: string, status: string) {
    const response = page.waitForResponse((item) => item.url().includes(`/actions/${key}`) && item.request().method() === 'POST' && item.status() === 200);
    await page.getByRole('button', { name: `${label} : ${opportunity}`, exact: true }).click();
    await response;
    await expect(row).toContainText(status);
  }
  await runAction('Qualifier', 'qualifier', 'Qualifiée');
  await runAction('Envoyer la proposition', 'proposer', 'Proposition envoyée');
  await runAction('Conclure', 'conclure', 'Gagnée');
  await expect(page.getByRole('button', { name: `Marquer perdue : ${opportunity}`, exact: true })).toHaveCount(0);
  await page.reload();
  await expect(row).toContainText('Gagnée');
  await expect(row).toContainText(client);
  await expect(row).toContainText('12500.5');
  await expectApplicationAccessible(page);

  await page.getByRole('button', { name: /Routes & droits/ }).click();
  const qualifyRoute = page.locator('.application-route-list article').filter({ hasText: 'Qualifier : Opportunité' });
  const concludeRoute = page.locator('.application-route-list article').filter({ hasText: 'Conclure : Opportunité' });
  await expect(qualifyRoute).toContainText('Commercial');
  await expect(qualifyRoute).not.toContainText('Validation');
  await expect(concludeRoute).toContainText('Validation');
  await expect(concludeRoute).not.toContainText('Commercial');
  await page.getByRole('button', { name: /^Opportunités/ }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  const dimensions = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1);
  await expect(row).toContainText('Gagnée');
  await page.screenshot({ path: 'test-results/commercial-management-mobile.png', fullPage: true, animations: 'disabled' });
  expect(browserErrors).toEqual([]);
});
