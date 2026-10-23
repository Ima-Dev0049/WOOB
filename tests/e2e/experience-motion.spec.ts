import { test, expect, type Page } from '@playwright/test';
import { createProjectThroughWizard } from './project-wizard';

async function recordNativeRoutes(page: Page) {
  await page.addInitScript(() => {
    const nativeAnimate = Element.prototype.animate;
    Element.prototype.animate = function (keyframes, options) {
      if (this.classList.contains('experience-route')) {
        const root = document.documentElement;
        root.dataset.nativeRouteCalls = String(Number(root.dataset.nativeRouteCalls ?? 0) + 1);
      }
      return nativeAnimate.call(this, keyframes, options);
    };
  });
}

async function recordExperienceAnimations(page: Page) {
  await page.addInitScript(() => {
    document.addEventListener('animationstart', (event) => {
      if (!event.animationName.startsWith('experience-')) return;
      const root = document.documentElement;
      const names = new Set((root.dataset.experienceAnimations ?? '').split(',').filter(Boolean));
      names.add(event.animationName);
      root.dataset.experienceAnimations = Array.from(names).join(',');
    });
  });
}

async function experienceAnimations(page: Page): Promise<string[]> {
  return page.locator('html').evaluate((root) => (root.dataset.experienceAnimations ?? '').split(',').filter(Boolean));
}

test('les routes utilisent réellement WAAPI et le showcase répond au pointeur sans boucle', async ({ page }) => {
  await recordNativeRoutes(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.experience-route')).toHaveAttribute('data-route-state', 'entered');
  expect(Number(await page.locator('html').getAttribute('data-native-route-calls'))).toBeGreaterThan(0);
  await expect(page.locator('.experience-route')).toHaveCSS('opacity', '1');

  await page.getByRole('link', { name: 'Tarifs', exact: true }).first().click();
  await expect(page).toHaveURL(/\/pricing$/);
  await expect(page.locator('.experience-route')).toHaveAttribute('data-route-state', 'entered');
  expect(Number(await page.locator('html').getAttribute('data-native-route-calls'))).toBeGreaterThanOrEqual(2);

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const showcase = page.locator('.hero-showcase');
  await expect(showcase).toHaveAttribute('data-surface-state', 'entered');
  const body = showcase.locator('.showcase-body');
  const initialTransform = await body.evaluate((element) => getComputedStyle(element).transform);
  const bounds = await showcase.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(bounds!.x + bounds!.width * 0.82, bounds!.y + bounds!.height * 0.35);
  await expect(showcase).toHaveAttribute('data-surface-tilt-active', 'true');
  await expect.poll(() => body.evaluate((element) => getComputedStyle(element).transform)).not.toBe(initialTransform);
  await page.screenshot({ path: 'test-results/experience-marketing.png' });
  await page.mouse.move(0, 0);
  await expect(showcase).not.toHaveAttribute('data-surface-tilt-active', 'true');
  await expect(showcase).toHaveCSS('--surface-tilt-x', '0deg');
  await expect(showcase).toHaveCSS('--surface-tilt-y', '0deg');
});

test('authentification et création de projet ont des transitions natives qui se nettoient', async ({ page }) => {
  await recordExperienceAnimations(page);
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `10.95.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}` });
  await page.goto('/register', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.auth-main')).toHaveAttribute('data-surface-state', 'entered');
  await expect(page.locator('.auth-card')).toBeVisible();
  await page.screenshot({ path: 'test-results/experience-auth.png' });
  await page.getByLabel('Votre nom').fill('Experience Motion E2E');
  await page.getByLabel('Adresse email').fill(`experience-motion-${suffix}@example.com`);
  await page.getByLabel('Mot de passe').fill('mot-de-passe-e2e-tres-long');
  await page.getByRole('button', { name: 'Créer mon espace' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator('.app-page-header')).toHaveAttribute('data-surface-state', 'entered');
  await page.locator('.app-page-header').getByRole('button', { name: 'Nouveau projet', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCSS('animation-name', 'experience-modal-in');
  await expect(page.locator('.modal-backdrop')).toHaveCSS('animation-name', 'experience-backdrop-in');
  await expect.poll(() => experienceAnimations(page)).toContain('experience-modal-in');
  await expect.poll(() => experienceAnimations(page)).toContain('experience-backdrop-in');
  await expect.poll(() => dialog.evaluate((element) => element.getAnimations().length)).toBe(0);
  await expect(dialog).toHaveCSS('opacity', '1');
  await expect(dialog).toHaveCSS('translate', 'none');
  await page.screenshot({ path: 'test-results/experience-project-modal.png' });
  await dialog.getByRole('button', { name: 'Fermer', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('le hero public compose ses contenus tout en préservant son entrée créative locale', async ({ page }) => {
  await recordExperienceAnimations(page);
  await page.goto('/demos/atelier-ligne', { waitUntil: 'domcontentloaded' });
  const hero = page.locator('.wb-hero');
  await expect(hero).toHaveAttribute('data-experience-state', 'entered');
  await expect(page.locator('.wb-node-hero')).toHaveAttribute('data-motion-preset', /.+/);
  await expect.poll(() => experienceAnimations(page)).toContain('experience-hero-title');
  await expect.poll(() => experienceAnimations(page)).toContain('experience-hero-visual');
  await expect(hero.locator('h1')).toHaveCSS('opacity', '1');
  await expect(hero.locator('h1')).toHaveCSS('translate', 'none');
  await expect(hero.locator('.hero-visual')).toHaveCSS('scale', 'none');
  await expect(hero.locator('h1')).toHaveCSS('animation-name', 'none');
  await page.screenshot({ path: 'test-results/experience-public-hero.png', fullPage: true });
});

test('l’éditeur anime réellement le changement de viewport et ses panneaux transitoires', async ({ page }) => {
  await recordExperienceAnimations(page);
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `10.96.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}` });
  await page.goto('/register');
  await page.getByLabel('Votre nom').fill('Editor Motion E2E');
  await page.getByLabel('Adresse email').fill(`editor-motion-${suffix}@example.com`);
  await page.getByLabel('Mot de passe').fill('mot-de-passe-e2e-tres-long');
  await page.getByRole('button', { name: 'Créer mon espace' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await createProjectThroughWizard(page, `Motion éditeur ${suffix}`);
  await page.getByRole('link', { name: 'Ouvrir l’éditeur →' }).click();
  await expect(page).toHaveURL(/\/editor\/[a-f0-9-]+$/);
  const canvas = page.locator('.canvas-document');
  await expect(canvas).toBeVisible();
  const desktopWidth = (await canvas.boundingBox())!.width;
  await expect(canvas).toHaveCSS('max-width', '1180px');
  await canvas.evaluate((element) => {
    element.addEventListener('transitionrun', (event) => {
      if ((event as TransitionEvent).propertyName === 'max-width') element.setAttribute('data-test-canvas-transition', 'true');
    });
  });
  await page.locator('.viewport-buttons button[title="Mobile"]').click();
  await expect(page.getByTestId('editor-canvas')).toHaveClass(/viewport-mobile/);
  await expect(canvas).toHaveAttribute('data-test-canvas-transition', 'true');
  await expect(canvas).toHaveCSS('max-width', '390px');
  await expect.poll(() => canvas.evaluate((element) => element.getBoundingClientRect().width)).toBeLessThan(desktopWidth);
  await expect.poll(() => canvas.evaluate((element) => element.getAnimations().length)).toBe(0);

  await page.getByRole('button', { name: '◐ Thème' }).click();
  await page.locator('.editor-right .font-family-trigger').first().click();
  const catalog = page.locator('.editor-right .font-catalog');
  await expect(catalog).toBeVisible();
  await expect(catalog).toHaveCSS('animation-name', 'experience-panel-in');
  await expect.poll(() => experienceAnimations(page)).toContain('experience-panel-in');
  await expect.poll(() => catalog.evaluate((element) => element.getAnimations().length)).toBe(0);
  await page.screenshot({ path: 'test-results/experience-editor.png' });
});

test('reduced-motion supprime route, tilt et ouverture publique sans masquer le contenu', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await recordNativeRoutes(page);
  await recordExperienceAnimations(page);
  await page.goto('/demos/atelier-ligne', { waitUntil: 'domcontentloaded' });
  const hero = page.locator('.wb-hero');
  await expect(hero).toHaveAttribute('data-experience-state', 'entered');
  await expect(hero.locator('h1')).toHaveCSS('opacity', '1');
  await expect(hero.locator('h1')).toHaveCSS('animation-name', 'none');
  expect(Number(await page.locator('html').getAttribute('data-native-route-calls') ?? 0)).toBe(0);
  expect((await experienceAnimations(page)).filter((name) => name.startsWith('experience-hero'))).toEqual([]);

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const showcase = page.locator('.hero-showcase');
  await expect(showcase).toHaveAttribute('data-surface-state', /visible|entered/);
  const bounds = await showcase.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(bounds!.x + bounds!.width * 0.8, bounds!.y + bounds!.height * 0.4);
  await expect(showcase).not.toHaveAttribute('data-surface-tilt-active', 'true');
  await expect(showcase.locator('.showcase-body')).toHaveCSS('transform', 'none');
  await expect(page.locator('.marketing-hero h1')).toHaveCSS('opacity', '1');
  expect(Number(await page.locator('html').getAttribute('data-native-route-calls') ?? 0)).toBe(0);
});
