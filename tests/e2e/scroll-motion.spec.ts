import { test, expect, type Page } from '@playwright/test';
import { createProjectThroughWizard } from './project-wizard';

async function register(page: Page, email: string) {
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `10.94.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}` });
  await page.goto('/register');
  await page.getByLabel('Votre nom').fill('Scroll Motion E2E');
  await page.getByLabel('Adresse email').fill(email);
  await page.getByLabel('Mot de passe').fill('mot-de-passe-e2e-tres-long');
  await page.getByRole('button', { name: 'Créer mon espace' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function generateMotionProposal(page: Page, pageId: string) {
  const response = page.waitForResponse((candidate) => candidate.url().includes(`/api/pages/${pageId}/ai`) && candidate.request().method() === 'POST');
  await page.getByRole('button', { name: 'Générer une proposition', exact: true }).click();
  expect((await response).status()).toBe(201);
}

test('la parallaxe IA est annulable, réversible, persistée, publiée et respecte reduced-motion', async ({ page, browser }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  await register(page, `scroll-motion-${suffix}@example.com`);
  await createProjectThroughWizard(page, `Projet scroll motion ${suffix}`, { brief: 'Un studio de céramique contemporain avec des collections tactiles et une galerie de pièces artisanales.' });
  const projectId = page.url().split('/').pop()!;
  await page.getByRole('link', { name: 'Ouvrir l’éditeur →' }).click();
  await expect(page).toHaveURL(/\/editor\/[a-f0-9-]+$/);
  const pageId = page.url().split('/').pop()!;
  const canvasHero = page.getByTestId('editor-canvas').locator('[data-node-type="hero"]').first();
  await canvasHero.click();
  await page.getByLabel('Mode éditeur').selectOption('advanced');

  await page.getByRole('button', { name: '✦ IA', exact: true }).click();
  await page.getByLabel('Votre consigne').fill('Ajoute une parallaxe de 64 px liée au défilement');
  await generateMotionProposal(page, pageId);
  const previewHero = page.locator('.ai-preview [data-node-type="hero"]').first();
  await expect(previewHero).toHaveAttribute('data-motion-preset', 'parallax');
  await expect(previewHero).toHaveAttribute('data-motion-trigger', 'scroll');
  await expect(previewHero).toHaveAttribute('data-motion-distance', '64');
  await expect(previewHero).toHaveAttribute('data-motion-state', 'tracking');
  await expect(canvasHero).not.toHaveAttribute('data-motion-preset', 'parallax');
  await page.locator('.ai-proposal-actions').getByRole('button', { name: 'Annuler', exact: true }).click();
  await expect(page.locator('.ai-preview')).toHaveCount(0);
  await expect(canvasHero).not.toHaveAttribute('data-motion-preset', 'parallax');

  await generateMotionProposal(page, pageId);
  await page.getByRole('button', { name: 'Appliquer au brouillon', exact: true }).click();
  await expect(canvasHero).toHaveAttribute('data-motion-preset', 'parallax');
  await page.getByTitle('Annuler (Ctrl+Z)').click();
  await expect(canvasHero).not.toHaveAttribute('data-motion-preset', 'parallax');
  await page.getByTitle('Rétablir (Ctrl+Shift+Z)').click();
  await expect(canvasHero).toHaveAttribute('data-motion-preset', 'parallax');
  await expect(page.getByLabel('Entrée au viewport')).toHaveValue('scroll');
  await expect(page.getByLabel('Style d’entrée')).toHaveValue('parallax');
  await page.getByLabel('Distance (px)').fill('72');

  const saveResponse = page.waitForResponse((response) => response.url().includes(`/api/pages/${pageId}/document`) && response.request().method() === 'PUT' && response.status() === 200);
  await page.getByTestId('save-page').click();
  await saveResponse;
  await expect(page.locator('.save-indicator')).toHaveClass(/saved/);
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByTestId('editor-canvas').locator('[data-node-type="hero"]').first().click();
  await expect(page.getByLabel('Entrée au viewport')).toHaveValue('scroll');
  await expect(page.getByLabel('Style d’entrée')).toHaveValue('parallax');
  await expect(page.getByLabel('Distance (px)')).toHaveValue('72');

  const publishResponse = page.waitForResponse((response) => response.url().includes(`/api/projects/${projectId}/publish`) && response.request().method() === 'POST' && response.status() === 201);
  await page.getByRole('button', { name: 'Publier', exact: true }).click();
  const published = await (await publishResponse).json() as { url: string };
  const origin = new URL(page.url()).origin;

  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' });
  const publicPage = await desktopContext.newPage();
  publicPage.on('pageerror', (error) => errors.push(error.message));
  await publicPage.goto(`${origin}${published.url}`, { waitUntil: 'networkidle' });
  const publicHero = publicPage.locator('[data-node-type="hero"]').first();
  await expect(publicHero).toHaveAttribute('data-motion-preset', 'parallax');
  await expect(publicHero).toHaveAttribute('data-motion-trigger', 'scroll');
  await expect(publicHero).toHaveAttribute('data-motion-distance', '72');
  await expect(publicHero).toHaveAttribute('data-motion-state', 'tracking');
  const initialProgress = await publicHero.getAttribute('data-motion-progress');
  expect(initialProgress).not.toBeNull();
  await publicPage.evaluate(() => window.scrollTo(0, 700));
  await expect.poll(() => publicHero.getAttribute('data-motion-progress')).not.toBe(initialProgress);
  const scrolledProgress = Number(await publicHero.getAttribute('data-motion-progress'));
  expect(scrolledProgress).toBeGreaterThan(Number(initialProgress));
  await publicPage.waitForTimeout(120);
  const settledProgress = await publicHero.getAttribute('data-motion-progress');
  await publicPage.waitForTimeout(350);
  expect(await publicHero.getAttribute('data-motion-progress')).toBe(settledProgress);
  await publicPage.emulateMedia({ reducedMotion: 'reduce' });
  await expect(publicHero).toHaveAttribute('data-motion-state', 'visible');
  await expect(publicHero).toHaveCSS('translate', 'none');
  expect(await publicHero.getAttribute('data-motion-progress')).toBeNull();
  await desktopContext.close();

  const reducedContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const reducedPage = await reducedContext.newPage();
  await reducedPage.goto(`${origin}${published.url}`, { waitUntil: 'networkidle' });
  const reducedHero = reducedPage.locator('[data-node-type="hero"]').first();
  await expect(reducedHero).toBeVisible();
  await expect(reducedHero).toHaveAttribute('data-motion-state', 'visible');
  await expect(reducedHero).toHaveCSS('translate', 'none');
  await expect(reducedHero).toHaveCSS('opacity', '1');
  expect(await reducedHero.getAttribute('data-motion-progress')).toBeNull();
  await reducedPage.evaluate(() => window.scrollTo(0, 500));
  expect(await reducedHero.getAttribute('data-motion-progress')).toBeNull();
  await reducedContext.close();

  const staticContext = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await staticContext.newPage();
  await staticPage.goto(`${origin}${published.url}`, { waitUntil: 'domcontentloaded' });
  const staticHero = staticPage.locator('[data-node-type="hero"]').first();
  await expect(staticHero).toBeVisible();
  await expect(staticHero).toHaveAttribute('data-motion-trigger', 'scroll');
  await expect(staticHero).toHaveCSS('opacity', '1');
  expect(await staticHero.getAttribute('data-motion-state')).toBeNull();
  await staticContext.close();
  expect(errors).toEqual([]);
});
