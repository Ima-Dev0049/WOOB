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

test('un portail public par site reçoit une demande, la modère et reste séparé du Studio', async ({ page }) => {
  test.setTimeout(180_000);
  const browserErrors: string[] = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  page.on('dialog', (dialog) => void dialog.accept());
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `10.94.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}` });
  await register(page, `site-portal-${suffix}@example.com`);
  await createProjectThroughWizard(page, `Portail ${suffix}`);
  await page.getByRole('link', { name: 'Modèle d’application →' }).click();
  const setupResponse = page.waitForResponse((response) => response.url().includes('/application') && response.request().method() === 'PUT' && response.status() === 200);
  await page.getByRole('button', { name: 'Initialiser un portail scolaire' }).click();
  await setupResponse;
  await expect(page.getByRole('heading', { name: 'Portail scolaire', exact: true })).toBeVisible();
  const applicationUrl = page.url();

  const form = page.locator('.application-record-form:not(.application-model-editor)');
  await page.getByRole('button', { name: 'Ajouter : Filière', exact: true }).click();
  await form.getByRole('textbox', { name: 'Nom de la filière', exact: true }).fill('Génie logiciel');
  await form.getByRole('textbox', { name: 'Code', exact: true }).fill('GL');
  await form.getByRole('textbox', { name: 'Description', exact: true }).fill('Formation en développement logiciel.');
  const createResponse = page.waitForResponse((response) => response.url().includes('/application/objects/filieres') && response.request().method() === 'POST' && response.status() === 201);
  await form.getByRole('button', { name: 'Créer l’enregistrement' }).click();
  await createResponse;

  const panel = page.getByRole('region', { name: 'Demandes en ligne' });
  await expect(panel).toBeVisible();
  await panel.getByRole('checkbox', { name: 'Ouvrir le portail public de ce site' }).check();
  await panel.getByRole('combobox', { name: 'Objet du formulaire public' }).selectOption('dossiers');
  await panel.getByRole('textbox', { name: 'Titre public' }).fill('Inscription en ligne');
  await panel.getByRole('textbox', { name: 'Introduction' }).fill('Déposez votre dossier, il sera examiné par le secrétariat.');
  const intakeResponse = page.waitForResponse((response) => response.url().includes('/public-intake') && response.request().method() === 'PUT' && response.status() === 200);
  await panel.getByRole('button', { name: 'Enregistrer le formulaire public' }).click();
  await intakeResponse;
  await expect(panel.getByRole('status')).toContainText('Formulaire public enregistré.');
  const portalLink = panel.getByRole('link', { name: 'Ouvrir le portail' });
  const portalHref = await portalLink.getAttribute('href');
  expect(portalHref).toMatch(/^\/portail\/.+/);

  await page.goto(portalHref!);
  await expect(page.getByRole('heading', { name: 'Inscription en ligne', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Créez votre compte sur ce site' })).toBeVisible();
  await expectApplicationAccessible(page);

  await page.getByRole('textbox', { name: 'Nom complet', exact: true }).fill('Awa Mensah');
  await page.getByRole('textbox', { name: 'Adresse email', exact: true }).fill(`awa-${suffix}@example.com`);
  await page.getByLabel(/^Mot de passe/).fill('mot-de-passe-portail-tres-long');
  const registerResponse = page.waitForResponse((response) => response.url().includes('/auth/register') && response.request().method() === 'POST' && response.status() === 201);
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await registerResponse;
  await expect(page.getByRole('heading', { name: 'Nouvelle demande' })).toBeVisible();

  await page.getByRole('textbox', { name: 'Nom complet', exact: true }).fill('Awa Mensah');
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(`awa-${suffix}@example.com`);
  await page.getByRole('combobox', { name: 'Filière', exact: true }).selectOption({ label: 'Génie logiciel' });
  await page.getByRole('textbox', { name: 'Motivation', exact: true }).fill('Je souhaite rejoindre cette formation à la rentrée.');
  const submitResponse = page.waitForResponse((response) => response.url().endsWith('/requests') && response.request().method() === 'POST' && response.status() === 201);
  await page.getByRole('button', { name: 'Envoyer ma demande' }).click();
  await submitResponse;
  await expect(page.getByRole('status').filter({ hasText: 'Votre demande est enregistrée' })).toBeVisible();
  const myRequests = page.getByRole('region', { name: 'Mes demandes' });
  await expect(myRequests).toContainText('Awa Mensah');
  await expect(myRequests).toContainText('Reçu');
  await expectApplicationAccessible(page);

  await page.screenshot({ path: 'test-results/site-portal-desktop.png', fullPage: true, animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  const dimensions = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1);
  await page.screenshot({ path: 'test-results/site-portal-mobile.png', fullPage: true, animations: 'disabled' });
  await page.setViewportSize({ width: 1440, height: 1000 });

  await page.goto(applicationUrl);
  await page.getByRole('button', { name: /^Dossiers/ }).click();
  const row = page.locator('.application-table tbody tr').filter({ hasText: 'Awa Mensah' });
  await expect(row).toBeVisible();
  const reviewResponse = page.waitForResponse((response) => response.url().includes('/application/objects/dossiers/') && response.request().method() === 'POST' && response.status() === 200);
  await page.getByRole('button', { name: 'Mettre en revue : Awa Mensah', exact: true }).click();
  await reviewResponse;
  await expect(row).toContainText('En revue');
  const acceptResponse = page.waitForResponse((response) => response.url().includes('/application/objects/dossiers/') && response.request().method() === 'POST' && response.status() === 200);
  await page.getByRole('button', { name: 'Accepter : Awa Mensah', exact: true }).click();
  await acceptResponse;
  await expect(row).toContainText('Accepté');

  await page.goto(portalHref!);
  const refreshedRequests = page.getByRole('region', { name: 'Mes demandes' });
  await expect(refreshedRequests).toContainText('Accepté');

  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await expect(page.getByRole('heading', { name: 'Créez votre compte sur ce site' })).toBeVisible();
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: `Portail ${suffix}`, level: 3 })).toBeVisible();
  expect(browserErrors).toEqual([]);
});
