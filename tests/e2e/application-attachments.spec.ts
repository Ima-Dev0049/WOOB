import { test, expect, type Page } from '@playwright/test';
import { createProjectThroughWizard } from './project-wizard';
import { expectApplicationAccessible } from './application-audit';

async function register(page: Page, email: string) {
  await page.goto('/register');
  await page.getByLabel('Votre nom').fill('Secrétariat E2E');
  await page.getByLabel('Adresse email').fill(email);
  await page.getByLabel('Mot de passe').fill('mot-de-passe-e2e-tres-long');
  await page.getByRole('button', { name: 'Créer mon espace' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
const pdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n', 'latin1');

test('les pièces jointes d’un dossier sont téléversées, listées et détachées', async ({ page }) => {
  const browserErrors: string[] = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  page.on('dialog', (dialog) => void dialog.accept());
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `10.83.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}` });
  await register(page, `attachments-${suffix}@example.com`);
  await createProjectThroughWizard(page, `Dossiers joints ${suffix}`);
  await page.getByRole('link', { name: 'Modèle d’application →' }).click();
  await expect(page.getByRole('heading', { name: 'Application gérée', exact: true })).toBeVisible();

  const setupResponse = page.waitForResponse((response) => response.url().includes('/application') && response.request().method() === 'PUT' && response.status() === 200);
  await page.getByRole('button', { name: 'Initialiser un portail scolaire' }).click();
  await setupResponse;

  await page.getByRole('button', { name: 'Ajouter : Filière', exact: true }).click();
  let form = page.locator('.application-record-form');
  await form.getByRole('textbox', { name: 'Nom de la filière', exact: true }).fill(`Gestion ${suffix}`);
  await form.getByRole('textbox', { name: 'Code', exact: true }).fill('GEST-E2E');
  await form.getByRole('textbox', { name: 'Description', exact: true }).fill('Filière de test des pièces jointes.');
  let createResponse = page.waitForResponse((response) => response.url().includes('/application/objects/filieres') && response.request().method() === 'POST' && response.status() === 201);
  await form.getByRole('button', { name: 'Créer l’enregistrement' }).click();
  await createResponse;

  await page.getByRole('button', { name: /^Dossiers/ }).click();
  await page.getByRole('button', { name: 'Ajouter : Dossier', exact: true }).click();
  form = page.locator('.application-record-form');
  const student = `Dossier E2E ${suffix}`;
  await form.getByRole('textbox', { name: 'Nom complet', exact: true }).fill(student);
  await form.getByRole('textbox', { name: 'Email', exact: true }).fill(`dossier-${suffix}@example.com`);
  await form.getByRole('textbox', { name: 'Téléphone', exact: true }).fill('+229 01 02 03 04');
  await form.getByRole('combobox', { name: 'Filière', exact: true }).selectOption({ label: `Gestion ${suffix}` });
  await form.getByRole('textbox', { name: 'Motivation', exact: true }).fill('Vérifier les pièces jointes dans le navigateur.');
  createResponse = page.waitForResponse((response) => response.url().includes('/application/objects/dossiers') && response.request().method() === 'POST' && response.status() === 201);
  await form.getByRole('button', { name: 'Créer l’enregistrement' }).click();
  await createResponse;
  await expect(page.locator('.application-table tbody tr').filter({ hasText: student })).toBeVisible();

  // A new record has no attachment section yet: the files belong to a saved record.
  await page.getByRole('button', { name: `Modifier : ${student}`, exact: true }).click();
  form = page.locator('.application-record-form');
  const section = form.locator('.application-attachments');
  await expect(section.getByRole('heading', { name: 'Pièces jointes', exact: true })).toBeVisible();
  await expect(section.getByText('Aucun fichier joint à ce dossier.', { exact: true })).toBeVisible();
  await expect(section.getByText('0 / 5', { exact: true })).toBeVisible();

  const uploadResponse = page.waitForResponse((response) => response.url().includes('/assets') && response.request().method() === 'POST' && response.status() === 201);
  const attachResponse = page.waitForResponse((response) => response.url().includes('/attachments') && response.request().method() === 'POST' && response.status() === 201);
  await section.locator('#application-attachment-file').setInputFiles({ name: 'plan.png', mimeType: 'image/png', buffer: png });
  await section.getByLabel('Libellé affiché').fill('Plan du dossier');
  await section.getByRole('button', { name: 'Joindre le fichier' }).click();
  await uploadResponse;
  await attachResponse;
  const link = section.getByRole('link', { name: 'Plan du dossier', exact: true });
  await expect(link).toBeVisible();
  await expect(section.getByText('1 / 5', { exact: true })).toBeVisible();
  await expect(section.getByText('Pièce jointe ajoutée.', { exact: true })).toBeVisible();
  const href = await link.getAttribute('href');
  expect(href).toMatch(/^\/media\/[0-9a-f-]{36}$/);
  const media = await page.request.get(href!);
  expect(media.status()).toBe(200);
  expect(media.headers()['content-type']).toBe('image/png');
  expect(media.headers()['content-disposition']).toContain('inline');

  const pdfUploadResponse = page.waitForResponse((response) => response.url().includes('/assets') && response.request().method() === 'POST' && response.status() === 201);
  const pdfAttachResponse = page.waitForResponse((response) => response.url().includes('/attachments') && response.request().method() === 'POST' && response.status() === 201);
  await section.locator('#application-attachment-file').setInputFiles({ name: 'devis.pdf', mimeType: 'application/pdf', buffer: pdf });
  await expect(section.getByLabel('Libellé affiché')).toHaveAttribute('placeholder', 'devis.pdf');
  await section.getByRole('button', { name: 'Joindre le fichier' }).click();
  await pdfUploadResponse;
  await pdfAttachResponse;
  await expect(section.getByRole('link', { name: 'devis.pdf', exact: true })).toBeVisible();
  await expect(section.getByText('2 / 5', { exact: true })).toBeVisible();
  const pdfHref = await section.getByRole('link', { name: 'devis.pdf', exact: true }).getAttribute('href');
  const pdfMedia = await page.request.get(pdfHref!);
  expect(pdfMedia.status()).toBe(200);
  expect(pdfMedia.headers()['content-type']).toBe('application/pdf');
  expect(pdfMedia.headers()['content-disposition']).toContain('attachment');
  await expectApplicationAccessible(page);
  await page.screenshot({ path: 'test-results/application-attachments-desktop.png', fullPage: true });

  const detachResponse = page.waitForResponse((response) => response.url().includes('/attachments?attachmentId=') && response.request().method() === 'DELETE' && response.status() === 200);
  await section.getByRole('button', { name: 'Retirer Plan du dossier', exact: true }).click();
  await detachResponse;
  await expect(section.getByRole('link', { name: 'Plan du dossier', exact: true })).toHaveCount(0);
  await expect(section.getByText('1 / 5', { exact: true })).toBeVisible();
  await expect(section.getByText('Pièce jointe retirée.', { exact: true })).toBeVisible();

  // The section survives a reload and stays scoped to its record.
  await page.reload();
  await page.getByRole('button', { name: `Modifier : ${student}`, exact: true }).click();
  form = page.locator('.application-record-form');
  await expect(form.locator('.application-attachments').getByRole('link', { name: 'devis.pdf', exact: true })).toBeVisible();
  await expect(form.locator('.application-attachments').getByText('1 / 5', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(form.locator('.application-attachments')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/application-attachments-mobile.png', fullPage: true });
  await expect(browserErrors).toEqual([]);
});
