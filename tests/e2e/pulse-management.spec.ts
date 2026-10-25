import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function save(page: Page, pageId: string) {
  const response = page.waitForResponse((item) => item.url().includes(`/api/pages/${pageId}/document`) && item.request().method() === 'PUT' && item.status() === 200);
  await page.getByTestId('save-page').click();
  await response;
  await expect(page.locator('.save-indicator')).toHaveClass(/saved/);
}

async function audit(page: Page, include?: string) {
  const builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);
  if (include) builder.include(include);
  const result = await builder.analyze();
  return result.violations.map((violation) => ({ id: violation.id, impact: violation.impact, nodes: violation.nodes.map((node) => ({ target: node.target, summary: node.failureSummary })) }));
}

test('Pulse métrique traverse le wizard, l’éditeur et le site public responsive', async ({ page, browser }, testInfo) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const name = `École Pulse ${suffix}`;
  const brief = 'Une école qui veut présenter ses formations et simplifier le suivi des demandes de sa communauté.';
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `10.92.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}` });
  await page.goto('/register');
  await page.getByLabel('Votre nom').fill('Pulse métrique E2E');
  await page.getByLabel('Adresse email').fill(`pulse-${suffix}@example.com`);
  await page.getByLabel('Mot de passe').fill('mot-de-passe-e2e-tres-long');
  await page.getByRole('button', { name: 'Créer mon espace' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole('button', { name: /Nouveau projet/ }).first().click();
  await page.getByLabel('Nom du projet').fill(name);
  await page.getByLabel('Rechercher un type de site').fill('école');
  await page.locator('input[name="site-type"][value="education-school"]').check();
  await page.getByRole('button', { name: 'Continuer →' }).click();
  await page.getByLabel('Rechercher un domaine').fill('éducation');
  await page.locator('input[name="activity-domain"][value="education"]').check();
  await page.getByRole('button', { name: 'Continuer →' }).click();
  await expect(page.getByRole('checkbox', { name: /Formulaires et prospects/ })).toBeChecked();
  await page.getByRole('button', { name: 'Continuer →' }).click();
  await page.locator('input[name="design-style"][value="pulse-management"]').check();
  await page.getByRole('button', { name: 'Continuer →' }).click();
  await page.getByLabel(/Description libre/).fill(brief);

  const previewResponse = page.waitForResponse((response) => response.url().includes('/project-preview') && response.request().method() === 'POST' && response.status() === 201);
  await page.getByRole('button', { name: 'Générer l’aperçu →' }).click();
  await previewResponse;
  const preview = page.getByTestId('catalog-preview');
  await expect(preview).toBeVisible();
  await expect(preview.getByTestId('document-renderer')).toHaveAttribute('data-creative-concept', 'operations-pulse');
  await expect(preview.locator('.wb-hero')).toHaveClass(/wb-hero-operations/);
  await expect(preview.locator('.treatment-ledger')).toBeVisible();
  await expect(preview.locator('.features-bento')).toBeVisible();
  await expect(page.getByTestId('creative-concept-operations-pulse')).toHaveClass(/selected/);

  const createResponse = page.waitForResponse((response) => response.url().includes('/api/workspaces/') && response.url().endsWith('/projects') && response.request().method() === 'POST' && response.status() === 201);
  await page.getByRole('button', { name: 'Créer le projet →' }).click();
  await createResponse;
  await expect(page).toHaveURL(/\/dashboard\/projects\/[a-f0-9-]+$/);
  const projectId = page.url().split('/').pop()!;
  await page.getByRole('link', { name: 'Ouvrir l’éditeur →' }).click();
  await expect(page).toHaveURL(/\/editor\/[a-f0-9-]+$/);
  const pageId = page.url().split('/').pop()!;
  await expect(page.getByTestId('document-renderer')).toHaveAttribute('data-creative-concept', 'operations-pulse');

  const editorCanvas = page.getByTestId('editor-canvas');
  await editorCanvas.locator('[data-node-type="hero"]').click();
  await expect(page.getByTestId('field-layout')).toHaveValue('operations');
  await expect(page.getByTestId('field-visualTreatment')).toHaveValue('ledger');
  await editorCanvas.locator('[data-node-type="features"]').click();
  await expect(page.getByTestId('field-layout')).toHaveValue('bento');
  await save(page, pageId);
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByTestId('document-renderer')).toHaveAttribute('data-creative-concept', 'operations-pulse');
  await page.getByTestId('editor-canvas').locator('[data-node-type="features"]').click();
  await expect(page.getByTestId('field-layout')).toHaveValue('bento');
  await page.getByRole('button', { name: '◐ Thème' }).click();
  await expect(page.getByLabel('Palette prédéfinie').locator('option[value="pulse-management"]')).toHaveText('Pulse métrique');
  await expect(page.getByLabel('Nom du thème personnalisé')).toHaveValue('Pulse métrique');
  const editorThemeCanvas = page.locator('.canvas-document');
  const themeDeclarations = async () => (await editorThemeCanvas.getAttribute('style'))?.split(';').map((declaration) => declaration.trim().replace(/\s*:\s*/, ':')).filter(Boolean).sort() ?? [];
  const originalThemeStyle = await themeDeclarations();
  await page.getByLabel('Palette prédéfinie').selectOption('pulse-management');
  expect(await audit(page, '.canvas-document')).toEqual([]);
  await page.getByTitle('Annuler (Ctrl+Z)').click();
  await expect.poll(themeDeclarations).toEqual(originalThemeStyle);

  const publishResponse = page.waitForResponse((response) => response.url().includes(`/api/projects/${projectId}/publish`) && response.request().method() === 'POST' && response.status() === 201);
  await page.getByRole('button', { name: 'Publier', exact: true }).click();
  const published = await (await publishResponse).json() as { url: string };
  const origin = new URL(page.url()).origin;

  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' });
  const publicPage = await desktopContext.newPage();
  publicPage.on('pageerror', (error) => errors.push(error.message));
  await publicPage.goto(`${origin}${published.url}`, { waitUntil: 'networkidle' });
  await expect(publicPage.getByTestId('document-renderer')).toHaveAttribute('data-creative-concept', 'operations-pulse');
  await expect(publicPage.locator('.wb-hero')).toHaveClass(/wb-hero-operations/);
  await expect(publicPage.locator('.treatment-ledger')).toBeVisible();
  await expect(publicPage.locator('.features-bento')).toBeVisible();
  await expect(publicPage.locator('[data-node-type="hero"]')).toHaveAttribute('data-motion-state', 'visible');
  const publicFeatures = publicPage.locator('[data-node-type="features"]');
  await publicFeatures.scrollIntoViewIfNeeded();
  await expect(publicFeatures).toHaveAttribute('data-motion-state', 'visible');
  await expect(publicFeatures).toHaveCSS('opacity', '1');
  await publicPage.evaluate(() => document.fonts.ready);
  await expect(publicPage.locator('.hero-copy h1')).toHaveCSS('font-family', /Space Grotesk/);
  const desktopHeroColumns = await publicPage.locator('.wb-hero').evaluate((element) => getComputedStyle(element).gridTemplateColumns);
  expect(desktopHeroColumns.split(' ')).toHaveLength(2);
  const desktopFeatureColumns = await publicPage.locator('.features-bento').evaluate((element) => getComputedStyle(element).gridTemplateColumns);
  expect(desktopFeatureColumns.split(' ')).toHaveLength(2);
  expect(await audit(publicPage)).toEqual([]);
  await publicPage.screenshot({ path: testInfo.outputPath('pulse-desktop.png'), fullPage: true });
  await desktopContext.close();

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const mobilePage = await mobileContext.newPage();
  mobilePage.on('pageerror', (error) => errors.push(error.message));
  await mobilePage.goto(`${origin}${published.url}`, { waitUntil: 'networkidle' });
  const mobileHero = mobilePage.locator('[data-node-type="hero"]');
  await expect(mobileHero).toBeVisible();
  await expect(mobileHero).toHaveAttribute('data-motion-state', 'visible');
  await expect(mobileHero).toHaveCSS('animation-name', 'none');
  await expect(mobileHero).toHaveCSS('opacity', '1');
  await expect(mobilePage.locator('.wb-header nav')).toBeVisible();
  const mobileHeroColumns = await mobilePage.locator('.wb-hero').evaluate((element) => getComputedStyle(element).gridTemplateColumns);
  expect(mobileHeroColumns.split(' ')).toHaveLength(1);
  const mobileFeatureColumns = await mobilePage.locator('.features-bento').evaluate((element) => getComputedStyle(element).gridTemplateColumns);
  expect(mobileFeatureColumns.split(' ')).toHaveLength(1);
  const widths = await mobilePage.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport + 1);
  expect(await audit(mobilePage)).toEqual([]);
  await mobilePage.evaluate(() => document.fonts.ready);
  await mobilePage.screenshot({ path: testInfo.outputPath('pulse-mobile.png'), fullPage: true });
  await mobileContext.close();
  expect(errors).toEqual([]);
});
