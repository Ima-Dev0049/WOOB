import { test, expect, type Page } from '@playwright/test';
import { createProjectThroughWizard } from './project-wizard';
import { expectApplicationAccessible } from './application-audit';

async function register(page: Page, email: string) {
  await page.goto('/register');
  await page.getByLabel('Votre nom').fill('Direction Universitaire');
  await page.getByLabel('Adresse email').fill(email);
  await page.getByLabel('Mot de passe').fill('mot-de-passe-e2e-tres-long');
  await page.getByRole('button', { name: 'Créer mon espace' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test('la gestion universitaire exécute étudiants, cours et inscriptions à deux relations', async ({ page }) => {
  test.setTimeout(120_000);
  const browserErrors: string[] = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  page.on('dialog', (dialog) => void dialog.accept());
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `10.93.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}` });
  await register(page, `university-${suffix}@example.com`);
  await createProjectThroughWizard(page, `Université gérée ${suffix}`);
  await page.getByRole('link', { name: 'Modèle d’application →' }).click();
  await expect(page.getByRole('heading', { name: 'Choisissez votre activité', exact: true })).toBeVisible();
  await expect(page.locator('.application-template-list article')).toHaveCount(4);
  await expect(page.getByRole('heading', { name: 'Gestion universitaire', exact: true })).toBeVisible();
  const setupResponse = page.waitForResponse((response) => response.url().includes('/application') && response.request().method() === 'PUT' && response.status() === 200);
  await page.getByRole('button', { name: 'Initialiser la gestion universitaire', exact: true }).click();
  await setupResponse;
  await expect(page.getByRole('heading', { name: 'Gestion universitaire', exact: true })).toBeVisible();
  await expect(page.locator('.application-runtime-note')).toContainText('Modèle v1');

  const form = page.locator('.application-record-form:not(.application-model-editor)');
  const student = `Étudiant ${suffix}`;
  await page.getByRole('button', { name: 'Ajouter : Étudiant', exact: true }).click();
  await form.getByRole('textbox', { name: 'Nom complet', exact: true }).fill(student);
  await form.getByRole('textbox', { name: 'Email', exact: true }).fill(`etudiant-${suffix}@example.com`);
  await form.getByRole('textbox', { name: 'Téléphone', exact: true }).fill('+229 01 02 03 04');
  await form.getByRole('textbox', { name: 'Notes administratives', exact: true }).fill('Dossier complet.');
  const createStudent = page.waitForResponse((response) => response.url().includes('/application/objects/etudiants') && response.request().method() === 'POST' && response.status() === 201);
  await form.getByRole('button', { name: 'Créer l’enregistrement' }).click();
  await createStudent;
  await expect(page.locator('.application-table tbody tr').filter({ hasText: student })).toContainText(`etudiant-${suffix}@example.com`);

  await page.getByRole('button', { name: /^Cours/ }).click();
  await page.getByRole('button', { name: 'Ajouter : Cours', exact: true }).click();
  const course = `Architecture ${suffix}`;
  await form.getByRole('textbox', { name: 'Intitulé du cours', exact: true }).fill(course);
  await form.getByRole('textbox', { name: 'Code du cours', exact: true }).fill('ARCH-401');
  await form.getByRole('spinbutton', { name: 'Crédits', exact: true }).fill('6');
  await form.getByRole('combobox', { name: 'Semestre', exact: true }).selectOption('s1');
  await form.getByRole('textbox', { name: 'Description', exact: true }).fill('Conception d’applications modulaires.');
  const createCourse = page.waitForResponse((response) => response.url().includes('/application/objects/cours') && response.request().method() === 'POST' && response.status() === 201);
  await form.getByRole('button', { name: 'Créer l’enregistrement' }).click();
  await createCourse;
  await expect(page.locator('.application-table tbody tr').filter({ hasText: course })).toContainText('Semestre 1');

  await page.getByRole('button', { name: /^Inscriptions/ }).click();
  await page.getByRole('button', { name: 'Ajouter : Inscription', exact: true }).click();
  const reference = `INS-${suffix}`;
  await form.getByRole('textbox', { name: 'Référence', exact: true }).fill(reference);
  await form.getByRole('combobox', { name: 'Étudiant', exact: true }).selectOption({ label: student });
  await form.getByRole('combobox', { name: 'Cours', exact: true }).selectOption({ label: course });
  await form.getByRole('textbox', { name: 'Date de rentrée', exact: true }).fill('2027-09-01');
  await form.getByRole('textbox', { name: 'Notes', exact: true }).fill('Inscription prioritaire.');
  const createEnrollment = page.waitForResponse((response) => response.url().includes('/application/objects/inscriptions') && response.request().method() === 'POST' && response.status() === 201);
  await form.getByRole('button', { name: 'Créer l’enregistrement' }).click();
  await createEnrollment;
  const row = page.locator('.application-table tbody tr').filter({ hasText: reference });
  await expect(row).toContainText('Demandée');
  await expect(row).toContainText(student);
  await expect(row).toContainText(course);

  async function runAction(label: string, key: string, status: string) {
    const response = page.waitForResponse((item) => item.url().includes(`/actions/${key}`) && item.request().method() === 'POST' && item.status() === 200);
    await page.getByRole('button', { name: `${label} : ${reference}`, exact: true }).click();
    await response;
    await expect(row).toContainText(status);
  }
  await runAction('Accepter', 'accepter', 'Acceptée');
  await runAction('Activer', 'activer', 'Active');
  await runAction('Terminer', 'terminer', 'Terminée');
  await expect(page.getByRole('button', { name: `Annuler : ${reference}`, exact: true })).toHaveCount(0);
  await page.reload();
  await expect(row).toContainText('Terminée');
  await expect(row).toContainText(student);
  await expect(row).toContainText(course);
  await expectApplicationAccessible(page);

  await page.getByRole('button', { name: /Routes & droits/ }).click();
  const acceptRoute = page.locator('.application-route-list article').filter({ hasText: 'Accepter : Inscription' });
  const activateRoute = page.locator('.application-route-list article').filter({ hasText: 'Activer : Inscription' });
  await expect(acceptRoute).toContainText('Scolarité');
  await expect(acceptRoute).not.toContainText('Enseignement');
  await expect(activateRoute).toContainText('Enseignement');
  await expect(activateRoute).not.toContainText('Scolarité');
  await page.getByRole('button', { name: /^Inscriptions/ }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  const dimensions = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1);
  await expect(row).toContainText('Terminée');
  await page.screenshot({ path: 'test-results/university-management-mobile.png', fullPage: true, animations: 'disabled' });
  expect(browserErrors).toEqual([]);
});
