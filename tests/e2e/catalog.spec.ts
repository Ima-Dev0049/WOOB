import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function audit(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return result.violations.map((violation) => ({ id: violation.id, impact: violation.impact, nodes: violation.nodes.map((node) => ({ target: node.target, summary: node.failureSummary })) }));
}

test('créer un restaurant par les six étapes avec recherche, domaine, style et brief transmis', async ({ page }) => {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const name = `Chez Ama ${suffix}`;
  const brief = 'Cuisine béninoise de saison, produits locaux et accueil chaleureux.';
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `10.110.${Math.floor(Math.random() * 200) + 1}.${Math.floor(Math.random() * 200) + 1}` });
  await page.goto('/register');
  await page.getByLabel('Votre nom').fill('Catalogue E2E');
  await page.getByLabel('Adresse email').fill(`catalogue-${suffix}@example.com`);
  await page.getByLabel('Mot de passe').fill('mot-de-passe-catalogue-tres-long');
  await page.getByRole('button', { name: 'Créer mon espace' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole('button', { name: /Nouveau projet/ }).first().click();
  await page.getByLabel('Nom du projet').fill(name);
  expect(await audit(page)).toEqual([]);

  await page.getByLabel('Rechercher un type de site').fill('restauration');
  await page.locator('input[name="site-type"][value="restaurant-classic"]').check();
  await page.getByRole('button', { name: 'Continuer →' }).click();
  await expect(page.getByRole('heading', { name: 'Quel est votre domaine d’activité ?' })).toBeVisible();
  await page.getByLabel('Rechercher un domaine').fill('alimentation');
  await page.locator('input[name="activity-domain"][value="food-agriculture"]').check();
  await page.getByRole('button', { name: 'Continuer →' }).click();
  await expect(page.getByRole('heading', { name: 'Quelles fonctionnalités réelles activez-vous ?' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /Demandes de réservation/ })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: /Catalogue et commandes manuelles/ })).not.toBeChecked();
  await page.getByRole('button', { name: 'Continuer →' }).click();
  await page.locator('input[name="design-style"][value="warm-artisanal"]').check();
  await page.getByRole('button', { name: 'Continuer →' }).click();
  await page.getByLabel(/Description libre/).fill(brief);
  await expect(page.getByLabel('Langue du contenu')).toHaveValue('fr');
  const previewResponse = page.waitForResponse((response) => response.url().includes('/project-preview') && response.status() === 201);
  await page.getByRole('button', { name: 'Générer l’aperçu →' }).click();
  await previewResponse;
  await expect(page.getByTestId('catalog-preview')).toBeVisible();
  await expect(page.getByText(/aucun modèle distant appelé/i)).toBeVisible();
  await expect(page.getByTestId('catalog-preview').locator('h1').first()).toHaveText(name);
  await expect(page.getByTestId('catalog-preview').locator('.wb-hero p').first()).toHaveText(brief);
  await expect(page.locator('.catalog-preview-pages').getByRole('button', { name: /Réservation/ })).toBeVisible();
  await expect(page.locator('.catalog-preview-pages').getByRole('button', { name: /Commander/ })).toHaveCount(0);
  await expect(page.getByText(/Aucune disponibilité en temps réel/)).toBeVisible();
  expect(await audit(page)).toEqual([]);

  const createResponse = page.waitForResponse((response) => response.url().includes('/projects') && response.request().method() === 'POST' && response.status() === 201);
  await page.getByRole('button', { name: 'Créer le projet →' }).click();
  await createResponse;
  await expect(page).toHaveURL(/\/dashboard\/projects\/[a-f0-9-]+$/);
  await expect(page.getByRole('paragraph').filter({ hasText: brief })).toBeVisible();
  await page.getByRole('link', { name: 'Ouvrir l’éditeur →' }).click();
  await expect(page.locator('[data-testid="editor-canvas"] h1').first()).toHaveText(name);
  await expect(page.locator('[data-testid="editor-canvas"] .wb-hero p').first()).toHaveText(brief);
});
