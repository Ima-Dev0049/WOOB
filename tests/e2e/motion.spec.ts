import { test, expect, type Page } from '@playwright/test';

async function expectRevealed(page: Page, selector: string) {
  const target = page.locator(selector);
  await expect(target).toHaveAttribute('data-surface-state', /visible|entered/);
  await expect(target).toHaveCSS('opacity', '1');
}

async function revealEntireSurface(page: Page) {
  const targets = await page.locator('[data-surface-reveal]').all();
  for (const target of targets) {
    await target.scrollIntoViewIfNeeded();
    await expect(target).toHaveAttribute('data-surface-state', /visible|entered/);
    await expect(target).toHaveCSS('opacity', '1');
    await expect(target).toHaveAttribute('data-surface-state', 'entered');
  }
}

test('le marketing révèle ses sections une fois et le header suit le scroll', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const heroTitle = page.locator('.marketing-hero h1');
  await expect(heroTitle).toHaveCSS('animation-name', 'surface-rise-in');
  await expectRevealed(page, '.marketing-hero h1');
  await expect(heroTitle).toHaveAttribute('data-surface-state', 'entered');
  await expect(heroTitle).toHaveCSS('animation-name', 'none');
  await expect(heroTitle).toHaveCSS('translate', 'none');
  await expectRevealed(page, '.hero-showcase');
  await page.screenshot({ path: 'test-results/motion-desktop.png' });

  await page.locator('#product').scrollIntoViewIfNeeded();
  await expectRevealed(page, '.feature-bento .bento-large');
  await expect(page.locator('.feature-bento .bento-large .bento-visual.layers')).toHaveCSS('animation-name', 'surface-layers-settle');
  await expect(page.locator('.feature-bento .devices span').first()).toHaveCSS('opacity', '1');
  await page.locator('.feature-bento').screenshot({ path: 'test-results/motion-bento.png' });
  await page.evaluate(() => window.scrollTo(0, 700));
  await expect(page.locator('.marketing-header')).toHaveClass(/is-scrolled/);
  await expect(page.locator('.marketing-header')).toHaveCSS('position', 'fixed');
  await expect.poll(() => page.locator('.marketing-header').evaluate((header) => Number(header.style.getPropertyValue('--surface-progress')))).toBeGreaterThan(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.locator('.marketing-header')).not.toHaveClass(/is-scrolled/);
  await page.getByRole('link', { name: 'Modèles', exact: true }).click();
  await expect(page).toHaveURL(/#templates$/);
  await expect.poll(() => page.locator('#templates').evaluate((section) => section.getBoundingClientRect().top)).toBeGreaterThanOrEqual(72);

  await revealEntireSurface(page);
  await expect(page.locator('[data-surface-state="pending"]')).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  // Freeze ambient loops only for the traced full-page image; behavior is asserted separately.
  await page.screenshot({ path: 'test-results/motion-desktop-full.png', fullPage: true, animations: 'disabled' });

  await page.goto('/pricing');
  await expectRevealed(page, '.pricing-intro');
  await revealEntireSurface(page);
  await expect(page.locator('.marketing-price-card')).toHaveCount(3);
  await expect(page.getByText('Aucun débit n’est simulé ici.', { exact: false })).toBeVisible();
});

test('reduced-motion rend immédiatement tout le contenu sans animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('[data-surface-state="pending"]')).toHaveCount(0);
  await expect(page.locator('[data-surface-reveal]')).toHaveCount(18);
  await expectRevealed(page, '.marketing-hero h1');
  await expect(page.locator('.marketing-hero h1')).toHaveCSS('animation-name', 'none');
  await expect(page.locator('.final-cta')).toHaveCSS('opacity', '1');
  await expect(page.locator('.final-cta')).toHaveCSS('visibility', 'visible');
  await page.evaluate(() => window.scrollTo(0, 700));
  await expect(page.locator('.marketing-header')).toHaveClass(/is-scrolled/);
  await expect(page.locator('.marketing-header')).toHaveCSS('--surface-progress', /\d/);
  expect(await page.locator('.marketing-header').evaluate((header) => getComputedStyle(header, '::after').display)).toBe('none');
});

test('le motion mobile conserve la composition et ne crée aucun débordement', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expectRevealed(page, '.marketing-hero h1');
  await expectRevealed(page, '.hero-showcase');
  await page.screenshot({ path: 'test-results/motion-mobile.png' });
  await page.locator('#templates').scrollIntoViewIfNeeded();
  await expectRevealed(page, '.template-preview >> nth=0');
  await expect(page.locator('.marketing-header')).toHaveClass(/is-scrolled/);
  const dimensions = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1);
  await page.evaluate(() => window.scrollBy(0, -110));
  await page.locator('.template-preview').first().screenshot({ path: 'test-results/motion-mobile-template.png' });
});

test('le HTML SSR reste lisible lorsque JavaScript est désactivé', async ({ browser }) => {
  const baseURL = test.info().project.use.baseURL;
  expect(typeof baseURL).toBe('string');
  const context = await browser.newContext({ baseURL: baseURL as string, javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveCSS('opacity', '1');
  await expect(page.locator('.final-cta')).toHaveCSS('opacity', '1');
  await expect(page.locator('[data-surface-state]')).toHaveCount(0);
  await page.locator('.feature-bento').screenshot({ path: 'test-results/motion-bento-ssr.png' });
  await context.close();
});

test('le tableau de bord révèle ses groupes sans bloquer les modales de création', async ({ page }) => {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `10.94.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}` });
  await page.goto('/register');
  await page.getByLabel('Votre nom').fill('Motion E2E');
  await page.getByLabel('Adresse email').fill(`motion-${suffix}@example.com`);
  await page.getByLabel('Mot de passe').fill('mot-de-passe-e2e-tres-long');
  await page.getByRole('button', { name: 'Créer mon espace' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expectRevealed(page, '.app-page-header');
  await expectRevealed(page, '.dashboard-stats');
  await revealEntireSurface(page);
  await expect(page.locator('.dashboard-projects')).toBeVisible();
  await expect(page.locator('.surface-motion-root')).toHaveCount(1);
  await page.screenshot({ path: 'test-results/motion-dashboard.png', fullPage: true });

  for (const scope of ['.app-page-header', '.empty-state']) {
    const trigger = page.locator(scope).getByRole('button', { name: 'Nouveau projet', exact: true });
    await trigger.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const backdrop = await page.locator('.modal-backdrop').boundingBox();
    expect(backdrop).not.toBeNull();
    expect(backdrop!.x).toBe(0);
    expect(backdrop!.y).toBe(0);
    expect(backdrop!.width).toBe(1440);
    expect(backdrop!.height).toBe(1000);
    await dialog.getByRole('button', { name: 'Continuer →', exact: true }).click();
    await expect(dialog.getByText(/Étape [23] sur 6/, { exact: true }).first()).toBeVisible();
    await dialog.getByRole('button', { name: 'Fermer', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
});
