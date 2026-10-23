import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createProjectThroughWizard } from './project-wizard';

async function registerAndOpen(page: Page, suffix: string) {
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `10.91.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}` });
  await page.goto('/register');
  await page.getByLabel('Votre nom').fill('Typographie E2E');
  await page.getByLabel('Adresse email').fill(`fonts-${suffix}@example.com`);
  await page.getByLabel('Mot de passe').fill('mot-de-passe-e2e-tres-long');
  await page.getByRole('button', { name: 'Créer mon espace' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await createProjectThroughWizard(page, `Polices E2E ${suffix}`);
  const projectId = page.url().split('/').pop()!;
  await page.getByRole('link', { name: 'Ouvrir l’éditeur →' }).click();
  await expect(page).toHaveURL(/\/editor\/[a-f0-9-]+$/);
  return { projectId, pageId: page.url().split('/').pop()! };
}

test('500 styles : sélection, canvas, persistance, publication et chargement local réel', async ({ page, browser }) => {
  const errors: string[] = [];
  const editorFonts = new Set<string>();
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (/^\/fonts\/[^/]+\.woff2$/.test(path)) editorFonts.add(path);
  });
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const { projectId, pageId } = await registerAndOpen(page, suffix);
  await page.getByRole('button', { name: '◐ Thème' }).click();
  const fields = page.locator('.editor-right .font-family-field');
  const body = fields.nth(0);
  const heading = fields.nth(1);

  await body.locator('.font-family-trigger').click();
  await expect(body.getByText('500 styles', { exact: true })).toBeVisible();
  await expect(body.getByText('50 familles variables · 10 graisses chacune', { exact: true })).toBeVisible();
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).include('.font-catalog').analyze();
  expect(accessibility.violations).toEqual([]);
  await body.getByLabel('Rechercher une famille pour Police du texte').fill('Fraunces');
  await expect(body.locator('.font-family-results button')).toHaveCount(1);
  await body.locator('.font-family-results button').click();
  const bodyWeight = page.getByLabel('Graisse — Police du texte', { exact: true });
  await expect(bodyWeight.locator('option')).toHaveCount(10);
  await bodyWeight.selectOption('600');
  await expect(page.locator('[data-testid="editor-canvas"] .hero-copy > p')).toHaveCSS('font-weight', '600');
  expect(await page.locator('[data-testid="editor-canvas"] .hero-copy > p').evaluate((element) => getComputedStyle(element).fontFamily)).toContain('Fraunces');

  await heading.locator('.font-family-trigger').click();
  await heading.getByLabel('Rechercher une famille pour Police des titres').fill('Playfair Display');
  await heading.locator('.font-family-results button').click();
  await page.getByLabel('Graisse — Police des titres', { exact: true }).selectOption('800');
  await expect(page.locator('[data-testid="editor-canvas"] h1').first()).toHaveCSS('font-weight', '800');
  expect(await page.locator('[data-testid="editor-canvas"] h1').first().evaluate((element) => getComputedStyle(element).fontFamily)).toContain('Playfair Display');
  expect(editorFonts.size).toBeLessThanOrEqual(3);

  const saveResponse = page.waitForResponse((response) => response.url().includes(`/api/pages/${pageId}/document`) && response.request().method() === 'PUT' && response.status() === 200);
  await page.getByTestId('save-page').click();
  await saveResponse;
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '◐ Thème' }).click();
  await expect(page.getByLabel('Graisse — Police du texte', { exact: true })).toHaveValue('600');
  await expect(page.getByLabel('Graisse — Police des titres', { exact: true })).toHaveValue('800');
  await expect(page.getByLabel('Police du texte, pile CSS personnalisée', { exact: true })).toHaveValue(/Fraunces/);
  await expect(page.getByLabel('Police des titres, pile CSS personnalisée', { exact: true })).toHaveValue(/Playfair Display/);

  const publishResponse = page.waitForResponse((response) => response.url().includes(`/api/projects/${projectId}/publish`) && response.request().method() === 'POST' && response.status() === 201);
  await page.getByRole('button', { name: 'Publier', exact: true }).click();
  const published = await (await publishResponse).json() as { url: string };
  const anonymous = await browser.newContext();
  const publicPage = await anonymous.newPage();
  const publicFonts = new Map<string, number>();
  publicPage.on('response', (response) => {
    const path = new URL(response.url()).pathname;
    if (/^\/fonts\/[^/]+\.woff2$/.test(path)) publicFonts.set(path, response.status());
  });
  await publicPage.goto(new URL(published.url, page.url()).toString(), { waitUntil: 'networkidle' });
  await expect(publicPage.locator('.published-site')).toHaveAttribute('style', /--site-body-font-weight:\s*600/);
  await expect(publicPage.locator('.published-site')).toHaveAttribute('style', /--site-heading-font-weight:\s*800/);
  await expect(publicPage.locator('.hero-copy > p')).toHaveCSS('font-weight', '600');
  await expect(publicPage.locator('h1').first()).toHaveCSS('font-weight', '800');
  const loaded = await publicPage.evaluate(async () => {
    await Promise.all([
      document.fonts.load('600 16px "Fraunces"', 'Typographie Woob'),
      document.fonts.load('800 32px "Playfair Display"', 'Typographie Woob'),
    ]);
    return [...document.fonts].map((face) => ({ family: face.family.replaceAll('"', ''), status: face.status }));
  });
  expect(loaded).toContainEqual({ family: 'Fraunces', status: 'loaded' });
  expect(loaded).toContainEqual({ family: 'Playfair Display', status: 'loaded' });
  expect(publicFonts).toEqual(new Map([
    ['/fonts/fraunces.woff2', 200],
    ['/fonts/playfair-display.woff2', 200],
  ]));
  await anonymous.close();
  expect(errors).toEqual([]);
});
