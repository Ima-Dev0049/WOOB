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
  const status = page.getByRole('combobox', { name: 'Filtrer par statut', exact: true });
  await status.selectOption('accepte');
  await expect(row).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe(student);
  await expect.poll(() => new URL(page.url()).searchParams.get('statut')).toBe('accepte');
  await page.reload();
  await expect(search).toHaveValue(student);
  await expect(status).toHaveValue('accepte');
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

test('la pagination et les relations recherchables fonctionnent au-delà du cache, sur mobile et sans mouvement', async ({ page }) => {
  test.setTimeout(180_000);
  const browserErrors: string[] = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `10.82.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}` });
  await register(page, `pagination-${suffix}@example.com`);
  await createProjectThroughWizard(page, `Pagination ${suffix}`);
  await page.getByRole('link', { name: 'Modèle d’application →' }).click();
  const setupResponse = page.waitForResponse((response) => response.url().includes('/application') && response.request().method() === 'PUT' && response.status() === 200);
  await page.getByRole('button', { name: 'Initialiser un portail scolaire' }).click();
  await setupResponse;
  await expect(page.getByRole('heading', { name: 'Portail scolaire', exact: true })).toBeVisible();

  const applicationPath = new URL(page.url()).pathname;
  const projectId = /\/dashboard\/projects\/([^/]+)\/application/.exec(applicationPath)?.[1];
  const csrf = (await page.context().cookies()).find((cookie) => cookie.name === 'woob_csrf')?.value;
  if (!projectId || !csrf) throw new Error('Le projet ou le jeton CSRF de test est introuvable.');
  const seededFilieres: { id: string; name: string }[] = [];
  for (let index = 0; index < 101; index += 1) {
    const name = `Filière ${String(index).padStart(2, '0')}`;
    const response = await page.request.post(`/api/projects/${projectId}/application/objects/filieres`, {
      headers: { 'x-csrf-token': csrf },
      data: { data: { nom: name, code: `P${String(index).padStart(2, '0')}`, description: index < 26 ? 'Donnée de pagination E2E.' : 'Donnée de relation E2E.' } },
    });
    expect(response.status()).toBe(201);
    const body = await response.json() as { record: { id: string } };
    seededFilieres.push({ id: body.record.id, name });
  }

  await page.goto(`${applicationPath}?objet=filieres`);
  const rows = page.locator('.application-table tbody tr:not(.application-empty-row)');
  const pagination = page.getByRole('navigation', { name: 'Pagination Filières', exact: true });
  const search = page.getByRole('textbox', { name: 'Rechercher dans Filières', exact: true });
  await expect(rows).toHaveCount(25);
  await expect(pagination).toContainText('Page 1 / 5');
  await expect(pagination).toContainText('1–25 sur 101');

  await page.getByRole('button', { name: /^Dossiers/ }).click();
  await page.getByRole('button', { name: 'Ajouter : Dossier', exact: true }).click();
  const relationForm = page.locator('.application-record-form');
  const relationSelect = relationForm.getByRole('combobox', { name: 'Filière', exact: true });
  const relationSearch = relationForm.getByRole('searchbox', { name: 'Rechercher : Filières', exact: true });
  await expect(relationSelect.locator('option')).toHaveCount(101);
  const initialOptionIds = await relationSelect.locator('option').evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value).filter(Boolean));
  const outside = seededFilieres.find((item) => !initialOptionIds.includes(item.id));
  const inside = seededFilieres.find((item) => initialOptionIds.includes(item.id));
  if (!outside || !inside) throw new Error('Les fixtures ne distinguent pas le cache initial et la relation externe.');
  await expect(relationSelect.getByRole('option', { name: outside.name, exact: true })).toHaveCount(0);

  const outsideResponse = page.waitForResponse((response) => {
    if (!response.url().includes('/application/objects/filieres?') || response.status() !== 200) return false;
    const params = new URL(response.url()).searchParams;
    return params.get('q') === outside.name && params.get('limit') === '50';
  });
  await relationSearch.fill(outside.name);
  await outsideResponse;
  await expect(relationSelect.getByRole('option', { name: outside.name, exact: true })).toHaveCount(1);
  await relationSelect.selectOption(outside.id);
  await expect(relationSelect).toHaveValue(outside.id);

  const insideResponse = page.waitForResponse((response) => {
    if (!response.url().includes('/application/objects/filieres?') || response.status() !== 200) return false;
    return new URL(response.url()).searchParams.get('q') === inside.name;
  });
  await relationSearch.fill(inside.name);
  await insideResponse;
  await expect(relationSelect.getByRole('option', { name: inside.name, exact: true })).toHaveCount(1);
  await expect(relationSelect.getByRole('option', { name: outside.name, exact: true })).toHaveCount(1);
  await expect(relationSelect).toHaveValue(outside.id);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: 'test-results/application-relation-search-desktop.png', fullPage: true, animations: 'disabled' });

  const student = `Dossier relation ${suffix}`;
  await relationForm.getByRole('textbox', { name: 'Nom complet', exact: true }).fill(student);
  await relationForm.getByRole('textbox', { name: 'Email', exact: true }).fill(`relation-${suffix}@example.com`);
  const createDossierResponse = page.waitForResponse((response) => response.url().includes('/application/objects/dossiers') && response.request().method() === 'POST' && response.status() === 201);
  const createdLabelResponse = page.waitForResponse((response) => {
    if (!response.url().includes('/application/objects/filieres?') || response.status() !== 200) return false;
    return new URL(response.url()).searchParams.getAll('id').includes(outside.id);
  });
  await relationForm.getByRole('button', { name: 'Créer l’enregistrement' }).click();
  await createDossierResponse;
  await createdLabelResponse;
  const relatedRow = page.locator('.application-table tbody tr').filter({ hasText: student });
  await expect(relatedRow).toContainText(outside.name);

  const reloadedLabelResponse = page.waitForResponse((response) => {
    if (!response.url().includes('/application/objects/filieres?') || response.status() !== 200) return false;
    return new URL(response.url()).searchParams.getAll('id').includes(outside.id);
  });
  await page.reload();
  await reloadedLabelResponse;
  await expect(relatedRow).toContainText(outside.name);
  await page.getByRole('button', { name: `Modifier : ${student}`, exact: true }).click();
  await expect(relationSelect).toHaveValue(outside.id);
  await expect(relationSelect.getByRole('option', { name: outside.name, exact: true })).toHaveCount(1);
  await page.setViewportSize({ width: 390, height: 844 });
  const relationDimensions = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  expect(relationDimensions.document).toBeLessThanOrEqual(relationDimensions.viewport + 1);
  expect((await relationSearch.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect((await relationSelect.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: 'test-results/application-relation-search-mobile.png', fullPage: true, animations: 'disabled' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await relationForm.getByRole('button', { name: 'Fermer', exact: true }).click();
  await expect(relatedRow).toContainText(outside.name);

  await page.getByRole('button', { name: /^Filières/ }).click();
  const pageQuery = 'Donnée de pagination';
  await search.fill(pageQuery);
  await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe(pageQuery);
  await expect(pagination).toContainText('Page 1 / 2');
  await expect(pagination).toContainText('1–25 sur 26');

  const nextPageResponse = page.waitForResponse((response) => {
    if (!response.url().includes('/application/objects/filieres?') || response.status() !== 200) return false;
    const params = new URL(response.url()).searchParams;
    return params.get('offset') === '25' && params.get('q') === pageQuery;
  });
  await page.getByRole('button', { name: 'Suivant', exact: true }).click();
  await nextPageResponse;
  await expect(rows).toHaveCount(1);
  await expect(pagination).toContainText('Page 2 / 2');
  await expect(pagination).toContainText('26–26 sur 26');
  await expect(page.getByRole('button', { name: 'Suivant', exact: true })).toBeDisabled();
  await expect.poll(() => new URL(page.url()).searchParams.get('page')).toBe('2');

  await page.reload();
  await expect(search).toHaveValue(pageQuery);
  await expect(rows).toHaveCount(1);
  await expect(pagination).toContainText('Page 2 / 2');
  expect(new URL(page.url()).searchParams.get('objet')).toBe('filieres');
  expect(new URL(page.url()).searchParams.get('page')).toBe('2');

  const firstRow = rows.first();
  await expect.poll(() => firstRow.evaluate((element) => getComputedStyle(element).animationName)).toBe('application-record-enter');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => firstRow.evaluate((element) => getComputedStyle(element).display)).toBe('grid');
  const dimensions = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
    table: document.querySelector('.application-table-wrap')?.scrollWidth ?? 0,
    tableClient: document.querySelector('.application-table-wrap')?.clientWidth ?? 0,
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1);
  expect(dimensions.table).toBeLessThanOrEqual(dimensions.tableClient + 1);
  const previousBox = await page.getByRole('button', { name: 'Précédent', exact: true }).boundingBox();
  expect(previousBox?.height).toBeGreaterThanOrEqual(44);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => firstRow.evaluate((element) => getComputedStyle(element).animationName)).toBe('none');
  await page.getByRole('button', { name: 'Ajouter : Filière', exact: true }).click();
  const form = page.locator('.application-record-form');
  await expect(form).toBeVisible();
  await expect.poll(() => form.evaluate((element) => getComputedStyle(element).animationName)).toBe('none');
  await form.getByRole('button', { name: 'Fermer', exact: true }).click();
  await page.screenshot({ path: 'test-results/application-pagination-mobile.png', fullPage: true, animations: 'disabled' });
  expect(browserErrors).toEqual([]);
});

test('le brouillon de modèle est prévisualisé, annulable puis appliqué sans élargir les droits', async ({ page }) => {
  test.setTimeout(120_000);
  const browserErrors: string[] = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `10.83.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}` });
  await register(page, `model-editor-${suffix}@example.com`);
  await createProjectThroughWizard(page, `Éditeur de modèle ${suffix}`);
  await page.getByRole('link', { name: 'Modèle d’application →' }).click();
  const setupResponse = page.waitForResponse((response) => response.url().includes('/application') && response.request().method() === 'PUT' && response.status() === 200);
  await page.getByRole('button', { name: 'Initialiser un portail scolaire' }).click();
  await setupResponse;
  await expect(page.getByRole('heading', { name: 'Portail scolaire', exact: true })).toBeVisible();

  const openEditor = page.getByRole('button', { name: 'Personnaliser le modèle', exact: true });
  const editor = page.locator('.application-model-editor');
  const preview = page.getByRole('complementary', { name: 'Aperçu du brouillon de modèle', exact: true });
  await openEditor.click();
  await expect(editor.getByRole('button', { name: 'Appliquer le brouillon', exact: true })).toBeDisabled();

  async function addObjectDraft(label: string, pluralLabel: string) {
    await editor.getByRole('textbox', { name: 'Nom singulier', exact: true }).fill(label);
    await editor.getByRole('textbox', { name: 'Nom pluriel', exact: true }).fill(pluralLabel);
    await editor.getByRole('button', { name: 'Ajouter l’objet au brouillon', exact: true }).click();
  }

  await editor.getByRole('textbox', { name: 'Nom du modèle', exact: true }).fill('Portail annulé');
  await addObjectDraft('Temporaire', 'Temporaires');
  await expect(preview).toContainText('3 objets');
  await expect(preview).toContainText('15 routes logiques');
  await editor.getByRole('button', { name: 'Annuler le brouillon', exact: true }).click();
  await expect(editor).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Portail scolaire', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Temporaires/ })).toHaveCount(0);

  await openEditor.click();
  await editor.getByRole('textbox', { name: 'Nom du modèle', exact: true }).fill('Portail scolaire enrichi');
  await editor.getByRole('textbox', { name: 'Description du modèle', exact: true }).fill('Modèle enrichi par un brouillon structuré et vérifié.');
  await addObjectDraft('Club', 'Clubs');
  await expect(preview).toContainText('3 objets');
  await expect(preview).toContainText('15 routes logiques');
  await expect(preview.locator('code').filter({ hasText: 'club' })).toBeVisible();
  await expect(preview.getByText('Nouveau', { exact: true })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page.setViewportSize({ width: 390, height: 844 });
  const dimensions = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1);
  await page.screenshot({ path: 'test-results/application-model-editor-mobile.png', fullPage: true, animations: 'disabled' });
  await page.setViewportSize({ width: 1440, height: 1000 });

  const applyResponse = page.waitForResponse((response) => response.url().includes('/application') && response.request().method() === 'PUT' && response.status() === 200);
  await editor.getByRole('button', { name: 'Appliquer le brouillon', exact: true }).click();
  await applyResponse;
  await expect(editor).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Portail scolaire enrichi', exact: true })).toBeVisible();
  await expect(page.locator('.application-runtime-note')).toContainText('Modèle v2');

  await page.getByRole('button', { name: /^Clubs/ }).click();
  await page.getByRole('button', { name: 'Ajouter : Club', exact: true }).click();
  const form = page.locator('.application-record-form:not(.application-model-editor)');
  const clubName = `Club robotique ${suffix}`;
  await form.getByRole('textbox', { name: 'Nom', exact: true }).fill(clubName);
  const createResponse = page.waitForResponse((response) => response.url().includes('/application/objects/club') && response.request().method() === 'POST' && response.status() === 201);
  await form.getByRole('button', { name: 'Créer l’enregistrement' }).click();
  await createResponse;
  const row = page.locator('.application-table tbody tr').filter({ hasText: clubName });
  await expect(row).toBeVisible();
  await page.reload();
  await expect(row).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Portail scolaire enrichi', exact: true })).toBeVisible();

  await page.getByRole('button', { name: /Routes & droits/ }).click();
  const createRoute = page.locator('.application-route-list article').filter({ hasText: 'club.create' });
  await expect(createRoute).toContainText('Propriétaire');
  await expect(createRoute).toContainText('Direction');
  await expect(createRoute).not.toContainText('Secrétariat');
  await expect(page.locator('.application-routes > header .status-pill')).toHaveText('15 routes logiques');
  expect(browserErrors).toEqual([]);
});
