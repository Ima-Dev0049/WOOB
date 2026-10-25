import { test, expect, type Page } from '@playwright/test';
import { createProjectThroughWizard } from './project-wizard';
import { expectApplicationAccessible } from './application-audit';

async function register(page: Page, email: string) {
  await page.goto('/register');
  await page.getByLabel('Votre nom').fill('Direction Restaurant');
  await page.getByLabel('Adresse email').fill(email);
  await page.getByLabel('Mot de passe').fill('mot-de-passe-e2e-tres-long');
  await page.getByRole('button', { name: 'Créer mon espace' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test('la gestion restaurant exécute tables, réservations, rôles et processus de service', async ({ page }) => {
  test.setTimeout(120_000);
  const browserErrors: string[] = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  page.on('dialog', (dialog) => void dialog.accept());
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `10.91.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}` });
  await register(page, `restaurant-${suffix}@example.com`);
  await createProjectThroughWizard(page, `Restaurant géré ${suffix}`);
  await page.getByRole('link', { name: 'Modèle d’application →' }).click();
  await expect(page.getByRole('heading', { name: 'Choisissez votre activité', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Gestion de restaurant', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Gestion scolaire', exact: true })).toBeVisible();
  const setupResponse = page.waitForResponse((response) => response.url().includes('/application') && response.request().method() === 'PUT' && response.status() === 200);
  await page.getByRole('button', { name: 'Initialiser la gestion du restaurant', exact: true }).click();
  await setupResponse;
  await expect(page.getByRole('heading', { name: 'Gestion du restaurant', exact: true })).toBeVisible();
  await expect(page.locator('.application-runtime-note')).toContainText('Modèle v1');

  const form = page.locator('.application-record-form:not(.application-model-editor)');
  const tableName = `Terrasse ${suffix}`;
  await page.getByRole('button', { name: 'Ajouter : Table', exact: true }).click();
  await form.getByRole('textbox', { name: 'Nom de la table', exact: true }).fill(tableName);
  await form.getByRole('spinbutton', { name: 'Places', exact: true }).fill('4');
  await form.getByRole('combobox', { name: 'Zone', exact: true }).selectOption('terrasse');
  await form.getByRole('textbox', { name: 'Notes', exact: true }).fill('Table au calme.');
  const createTable = page.waitForResponse((response) => response.url().includes('/application/objects/tables') && response.request().method() === 'POST' && response.status() === 201);
  await form.getByRole('button', { name: 'Créer l’enregistrement' }).click();
  await createTable;
  await expect(page.locator('.application-table tbody tr').filter({ hasText: tableName })).toContainText('Terrasse');

  await page.getByRole('button', { name: /^Réservations/ }).click();
  await page.getByRole('button', { name: 'Ajouter : Réservation', exact: true }).click();
  const client = `Client ${suffix}`;
  await form.getByRole('textbox', { name: 'Nom du client', exact: true }).fill(client);
  await form.getByRole('textbox', { name: 'Email', exact: true }).fill(`client-${suffix}@example.com`);
  await form.getByRole('textbox', { name: 'Téléphone', exact: true }).fill('+229 01 02 03 04');
  await form.getByRole('textbox', { name: 'Date', exact: true }).fill('2026-12-24');
  await form.getByRole('combobox', { name: 'Service', exact: true }).selectOption('diner');
  await form.getByRole('spinbutton', { name: 'Convives', exact: true }).fill('2');
  await form.getByRole('combobox', { name: 'Table', exact: true }).selectOption({ label: tableName });
  await form.getByRole('textbox', { name: 'Notes', exact: true }).fill('Anniversaire.');
  const createReservation = page.waitForResponse((response) => response.url().includes('/application/objects/reservations') && response.request().method() === 'POST' && response.status() === 201);
  await form.getByRole('button', { name: 'Créer l’enregistrement' }).click();
  await createReservation;
  const row = page.locator('.application-table tbody tr').filter({ hasText: client });
  await expect(row).toContainText('Demandée');
  await expect(row).toContainText(tableName);

  async function runAction(label: string, key: string, status: string) {
    const response = page.waitForResponse((item) => item.url().includes(`/actions/${key}`) && item.request().method() === 'POST' && item.status() === 200);
    await page.getByRole('button', { name: `${label} : ${client}`, exact: true }).click();
    await response;
    await expect(row).toContainText(status);
  }
  await runAction('Confirmer', 'confirmer', 'Confirmée');
  await runAction('Installer', 'installer', 'Installée');
  await runAction('Terminer', 'terminer', 'Terminée');
  await expect(page.getByRole('button', { name: `Annuler : ${client}`, exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /^Vue d’ensemble/ }).click();
  await expect(page.getByRole('heading', { name: 'Vue d’ensemble', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/[?&]objet=summary/);
  await expect(page.locator('.application-summary > header .status-pill')).toHaveText('2 enregistrements');
  const tableCard = page.locator('.application-summary-card').filter({ has: page.getByRole('heading', { name: 'Tables', exact: true }) });
  const reservationCard = page.locator('.application-summary-card').filter({ has: page.getByRole('heading', { name: 'Réservations', exact: true }) });
  await expect(tableCard.locator('.application-summary-total strong')).toHaveText('1');
  await expect(reservationCard.locator('.application-summary-total strong')).toHaveText('1');
  await expect(reservationCard.locator('li').filter({ hasText: 'Demandée' })).toContainText('0');
  await expect(reservationCard.locator('li').filter({ hasText: 'Terminée' })).toContainText('1');
  await page.reload();
  await expect(page.locator('.application-summary > header .status-pill')).toHaveText('2 enregistrements');
  await expect(reservationCard.locator('li').filter({ hasText: 'Terminée' })).toContainText('1');
  await expectApplicationAccessible(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const summaryDimensions = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  expect(summaryDimensions.document).toBeLessThanOrEqual(summaryDimensions.viewport + 1);
  await page.screenshot({ path: 'test-results/application-summary-mobile.png', fullPage: true, animations: 'disabled' });

  await page.getByRole('button', { name: /Routes & droits/ }).click();
  const confirmRoute = page.locator('.application-route-list article').filter({ hasText: 'Confirmer : Réservation' });
  const installRoute = page.locator('.application-route-list article').filter({ hasText: 'Installer : Réservation' });
  await expect(confirmRoute).toContainText('Accueil');
  await expect(confirmRoute).not.toContainText('Service');
  await expect(installRoute).toContainText('Service');
  await expect(installRoute).not.toContainText('Accueil');
  await page.getByRole('button', { name: /^Réservations/ }).click();
  await expect(row).toContainText('Terminée');
  await expect(row).toContainText(tableName);
  await page.setViewportSize({ width: 390, height: 844 });
  const dimensions = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1);
  await expect(row).toContainText('Terminée');
  await page.screenshot({ path: 'test-results/restaurant-management-mobile.png', fullPage: true, animations: 'disabled' });
  expect(browserErrors).toEqual([]);
});
