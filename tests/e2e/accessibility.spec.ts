import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createProjectThroughWizard } from './project-wizard';

async function audit(page: Page) {
  // Attendre l’hydratation, puis auditer l’état stable : un fondu en cours modifie temporairement le contraste mesuré.
  await page.waitForLoadState('networkidle');
  await page.evaluate(async () => {
    // Révéler aussi les blocs sous la ligne de flottaison pour ne pas auditer seulement le premier écran.
    for (let y = 0; y < document.documentElement.scrollHeight; y += Math.max(400, window.innerHeight * .8)) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
    window.scrollTo(0, 0);
    await new Promise((resolve) => setTimeout(resolve, 80));
    for (const animation of document.getAnimations()) {
      if (animation.effect?.getTiming().iterations !== Infinity) animation.finish();
    }
  });
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return result.violations.map((violation) => ({ id: violation.id, impact: violation.impact, help: violation.help, nodes: violation.nodes.map((node) => ({ target: node.target, summary: node.failureSummary })) }));
}
async function register(page: Page, email: string) {
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `10.80.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}` });
  await page.goto('/register');
  await page.getByLabel('Votre nom').fill('Accessibilité E2E');
  await page.getByLabel('Adresse email').fill(email);
  await page.getByLabel('Mot de passe').fill('mot-de-passe-e2e-tres-long');
  await page.getByRole('button', { name: 'Créer mon espace' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test('accueil et connexion respectent les règles WCAG automatisées', async ({ page }) => {
  await page.goto('/');
  expect(await audit(page)).toEqual([]);
  await page.goto('/login');
  expect(await audit(page)).toEqual([]);
});

test('les trois démonstrations respectent les règles WCAG automatisées', async ({ page }) => {
  for (const path of [
    '/demos/king-food', '/demos/king-food/reservation',
    '/demos/atelier-ligne', '/demos/atelier-ligne/projets', '/demos/atelier-ligne/contact',
    '/demos/studio-cap', '/demos/studio-cap/formations',
  ]) {
    await page.goto(path);
    expect(await audit(page), path).toEqual([]);
  }
});

test('dashboard et éditeur respectent les règles WCAG automatisées', async ({ page }) => {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  await register(page, `a11y-${suffix}@example.com`);
  expect(await audit(page)).toEqual([]);
  await createProjectThroughWizard(page, `Accessibilité ${suffix}`);
  await page.getByRole('link', { name: 'Ouvrir l’éditeur →' }).click();
  await expect(page).toHaveURL(/\/editor\/[a-f0-9-]+$/);
  expect(await audit(page)).toEqual([]);
});
