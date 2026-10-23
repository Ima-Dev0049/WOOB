import { test, expect } from '@playwright/test';

test('le hero immersif suit le scroll sans boucle ni effet sur les autres pages marketing', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const hero = page.locator('.immersive-home .marketing-hero');
  const stage = page.locator('.hero-stage');
  await expect(hero).toHaveCSS('background-color', 'rgb(17, 23, 20)');
  await expect(page.locator('.hero-showcase')).toHaveAttribute('data-surface-state', 'entered');
  const progress = () => hero.evaluate((element) => Number(element.style.getPropertyValue('--surface-scene-progress')));
  expect(await progress()).toBe(0);
  const initialTransform = await stage.evaluate((element) => getComputedStyle(element).transform);

  await page.evaluate(() => window.scrollTo(0, 600));
  await expect.poll(progress).toBeGreaterThan(0);
  expect(await stage.evaluate((element) => getComputedStyle(element).transform)).not.toBe(initialTransform);
  await page.screenshot({ path: 'test-results/immersive-home-desktop.png' });
  const perpetualAnimations = await page.evaluate(() => document.getAnimations().filter((animation) => animation.effect?.getTiming().iterations === Infinity).length);
  expect(perpetualAnimations).toBe(0);

  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(progress).toBe(0);
  await page.goto('/pricing');
  await expect(page.locator('.immersive-home')).toHaveCount(0);
  await expect(page.locator('[data-surface-scene]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('mobile et reduced-motion conservent une scène statique, lisible et sans débordement', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const hero = page.locator('.marketing-hero');
  const stage = page.locator('.hero-stage');
  await expect(hero.locator('h1')).toBeVisible();
  await expect(hero.locator('h1')).toHaveCSS('opacity', '1');
  await expect(stage).toHaveCSS('transform', 'none');
  await page.screenshot({ path: 'test-results/immersive-home-mobile.png' });

  await page.evaluate(() => window.scrollTo(0, 600));
  await expect.poll(() => hero.evaluate((element) => Number(element.style.getPropertyValue('--surface-scene-progress')))).toBe(0);
  await expect(stage).toHaveCSS('transform', 'none');
  const dimensions = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1);

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => window.scrollTo(0, 600));
  await expect.poll(() => hero.evaluate((element) => Number(element.style.getPropertyValue('--surface-scene-progress')))).toBeGreaterThan(0);
});
