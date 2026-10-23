import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function save(page: Page, pageId: string) {
  const response = page.waitForResponse((item) => item.url().includes(`/api/pages/${pageId}/document`) && item.request().method() === 'PUT' && item.status() === 200);
  await page.getByTestId('save-page').click();
  await response;
  await expect(page.locator('.save-indicator')).toHaveClass(/saved/);
}

const HERO_LAYOUT: Record<string, string> = {
  'editorial-ritual': 'editorial', 'immersive-atlas': 'immersive', 'monumental-signal': 'monumental', 'product-stage': 'product-stage', 'clear-conversation': 'split',
};

test('le concept choisi, le motion édité et le responsive survivent jusqu’au site publié', async ({ page, browser }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `10.91.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}` });
  await page.goto('/register');
  await page.getByLabel('Votre nom').fill('Creative Engine E2E');
  await page.getByLabel('Adresse email').fill(`creative-${suffix}@example.com`);
  await page.getByLabel('Mot de passe').fill('mot-de-passe-e2e-tres-long');
  await page.getByRole('button', { name: 'Créer mon espace' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole('button', { name: /Nouveau projet/ }).first().click();
  await page.getByLabel('Nom du projet').fill(`Creative Engine ${suffix}`);
  await page.getByRole('button', { name: /Passer directement à la description/ }).click();
  await page.getByLabel(/Description libre/).fill('Un studio de céramique pour les collectionneurs curieux, avec une approche chaleureuse et des pièces artisanales.');
  const previewResponse = page.waitForResponse((response) => response.url().includes('/project-preview') && response.request().method() === 'POST' && response.status() === 201);
  await page.getByRole('button', { name: 'Générer l’aperçu →' }).click();
  await previewResponse;
  await expect(page.getByTestId('catalog-preview')).toBeVisible();
  await expect(page.getByTestId('project-brief')).toBeVisible();
  await expect(page.getByTestId('project-brief')).toContainText('Brief structuré');
  await expect(page.getByTestId('project-brief')).toContainText('Hypothèses à confirmer');
  await expect(page.locator('.creative-concept')).toHaveCount(3);
  await expect(page.getByTestId('creative-quality')).toContainText('Aucune inspection visuelle automatique');
  await expect(page.locator('.catalog-preview-canvas .editor-node')).toHaveCount(0);
  const accessibility = await new AxeBuilder({ page }).include('.project-brief').include('.creative-directions').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(accessibility.violations).toEqual([]);

  const alternative = page.locator('.creative-concept:not(.selected)').first();
  const conceptId = await alternative.locator('input').inputValue();
  const expectedLayout = HERO_LAYOUT[conceptId]!;
  await alternative.click();
  await expect(page.getByTestId('document-renderer')).toHaveAttribute('data-creative-concept', conceptId);
  await expect(page.locator('.catalog-preview-canvas .wb-hero')).toHaveClass(new RegExp(`wb-hero-${expectedLayout}`));
  const createResponse = page.waitForResponse((response) => response.url().includes('/api/workspaces/') && response.url().endsWith('/projects') && response.request().method() === 'POST' && response.status() === 201);
  await page.getByRole('button', { name: 'Créer le projet →' }).click();
  await createResponse;
  await expect(page).toHaveURL(/\/dashboard\/projects\/[a-f0-9-]+$/);
  await expect(page.getByTestId('project-brief')).toBeVisible();
  await expect(page.getByTestId('project-brief')).toContainText('Un studio de céramique');
  const projectId = page.url().split('/').pop()!;
  await page.getByRole('link', { name: 'Ouvrir l’éditeur →' }).click();
  await expect(page).toHaveURL(/\/editor\/[a-f0-9-]+$/);
  const pageId = page.url().split('/').pop()!;
  await expect(page.getByTestId('document-renderer')).toHaveAttribute('data-creative-concept', conceptId);
  const hero = page.locator('[data-testid="editor-canvas"] [data-node-type="hero"]');
  await hero.click();
  await expect(page.getByTestId('field-layout')).toHaveValue(expectedLayout);
  await page.getByLabel('Style d’entrée').selectOption('fade');
  await page.getByLabel('Mode éditeur').selectOption('advanced');
  await page.getByLabel('Durée (ms)').fill('700');
  await save(page, pageId);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-testid="editor-canvas"] [data-node-type="hero"]').click();
  await expect(page.getByLabel('Style d’entrée')).toHaveValue('fade');
  await expect(page.getByLabel('Durée (ms)')).toHaveValue('700');

  const publishResponse = page.waitForResponse((response) => response.url().includes(`/api/projects/${projectId}/publish`) && response.request().method() === 'POST' && response.status() === 201);
  await page.getByRole('button', { name: 'Publier', exact: true }).click();
  const published = await (await publishResponse).json() as { url: string };
  const origin = new URL(page.url()).origin;
  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' });
  const publicPage = await desktopContext.newPage();
  await publicPage.goto(`${origin}${published.url}`, { waitUntil: 'networkidle' });
  await expect(publicPage.getByTestId('document-renderer')).toHaveAttribute('data-creative-concept', conceptId);
  await expect(publicPage.locator('.wb-hero')).toHaveClass(new RegExp(`wb-hero-${expectedLayout}`));
  const publicHero = publicPage.locator('[data-node-type="hero"]');
  await expect(publicHero).toHaveAttribute('data-motion-preset', 'fade');
  await expect(publicHero).toHaveAttribute('data-motion-state', 'visible');
  await expect(publicHero).toHaveCSS('animation-name', 'woob-creative-fade');
  const buttonColors = await publicPage.locator('.hero-copy .button.primary').evaluate((element) => ({ color: getComputedStyle(element).color, background: getComputedStyle(element).backgroundColor }));
  expect(buttonColors.color).not.toBe(buttonColors.background);
  await desktopContext.close();

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(`${origin}${published.url}`, { waitUntil: 'networkidle' });
  const mobileHero = mobilePage.locator('[data-node-type="hero"]');
  await expect(mobileHero).toBeVisible();
  await expect(mobilePage.locator('.wb-header nav')).toBeVisible();
  await expect(mobileHero).toHaveAttribute('data-motion-state', 'visible');
  await expect(mobileHero).toHaveCSS('animation-name', 'none');
  await expect(mobileHero).toHaveCSS('opacity', '1');
  const widths = await mobilePage.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport + 1);
  const columns = await mobilePage.locator('.wb-hero').evaluate((element) => getComputedStyle(element).gridTemplateColumns);
  expect(columns.split(' ')).toHaveLength(1);
  await mobileContext.close();
  expect(errors).toEqual([]);
});
