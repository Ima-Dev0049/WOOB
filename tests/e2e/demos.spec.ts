import { test, expect } from '@playwright/test';

const demos = [
  { slug: 'king-food', name: 'King Food', explore: 'Découvrir le menu', explorePath: '/demos/king-food/menu', exploreHeading: 'Une carte pensée pour donner faim', businessPath: '/demos/king-food/reservation' },
  { slug: 'atelier-ligne', name: 'Atelier Ligne', explore: 'Voir les études', explorePath: '/demos/atelier-ligne/projets', exploreHeading: 'Études visuelles', businessPath: '/demos/atelier-ligne/contact' },
  { slug: 'studio-cap', name: 'Studio Cap', explore: 'Explorer le programme', explorePath: '/demos/studio-cap/formations', exploreHeading: 'Un programme, trois étapes', businessPath: '/demos/studio-cap/formations' },
] as const;

test('les cartes de l’accueil ouvrent les vraies démonstrations', async ({ page }) => {
  await page.goto('/#templates');
  await page.getByRole('link', { name: /King Food/ }).click();
  await expect(page).toHaveURL(/\/demos\/king-food$/);
  await expect(page.getByRole('heading', { name: 'King Food', exact: true })).toBeVisible();
  await expect(page.getByText('Contenu de démonstration · actions métier inactives')).toBeVisible();
});

for (const demo of demos) {
  test(`${demo.name} permet de naviguer sans activer les actions métier`, async ({ page }) => {
    await page.goto(`/demos/${demo.slug}`);
    await expect(page.locator('[data-testid="document-renderer"]')).toHaveAttribute('data-creative-concept', /.+/);
    await page.locator('.wb-hero').getByRole('link', { name: demo.explore, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${demo.explorePath}$`));
    await expect(page.getByRole('heading', { name: demo.exploreHeading, exact: true })).toBeVisible();
    await page.goto(demo.businessPath);
    await expect(page.locator('[data-demo-inactive="true"]')).toBeVisible();
    await expect(page.getByText('Mode démonstration.', { exact: false })).toBeVisible();
    await expect(page.locator('form')).toHaveCount(0);
    await expect(page.locator('input, textarea, select')).toHaveCount(0);
  });
}

test('les démos restent dans la largeur mobile et les routes inconnues renvoient 404', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const demo of demos) {
    for (const path of [`/demos/${demo.slug}`, demo.businessPath]) {
      await page.goto(path);
      await expect(page.locator('[data-testid="document-renderer"]')).toBeVisible();
      const dimensions = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: window.innerWidth }));
      expect(dimensions.document, `${path} ne doit pas déborder horizontalement`).toBeLessThanOrEqual(dimensions.viewport);
    }
  }
  const response = await page.goto('/demos/site-inconnu');
  expect(response?.status()).toBe(404);
});
