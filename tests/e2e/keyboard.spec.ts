import { test, expect, type Page } from '@playwright/test';
import { createProjectThroughWizard } from './project-wizard';

async function register(page: Page, suffix: string) {
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `10.47.${Math.floor(Math.random() * 200) + 1}.${Math.floor(Math.random() * 200) + 1}` });
  await page.goto('/register');
  await page.getByLabel('Votre nom').fill('Test clavier');
  await page.getByLabel('Adresse email').fill(`keyboard-${suffix}@example.com`);
  await page.getByLabel('Mot de passe').fill('mot-de-passe-clavier-tres-long');
  await page.getByRole('button', { name: 'Créer mon espace' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function expectFocusInside(page: Page, selector: string) {
  expect(await page.evaluate((target) => {
    const container = document.querySelector(target);
    return Boolean(container && document.activeElement && container.contains(document.activeElement));
  }, selector)).toBe(true);
}

test('boucler le focus du dialogue projet, le fermer avec Échap et le restituer', async ({ page }) => {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  await register(page, suffix);
  const trigger = page.getByRole('button', { name: 'Nouveau projet', exact: true }).first();
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Créez votre projet' });
  await expect(dialog).toBeVisible();
  await expect(page.getByLabel('Nom du projet')).toBeFocused();
  for (let index = 0; index < 18; index += 1) await page.keyboard.press('Tab');
  await expectFocusInside(page, '.create-project-modal');
  for (let index = 0; index < 7; index += 1) await page.keyboard.press('Shift+Tab');
  await expectFocusInside(page, '.create-project-modal');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('conserver le focus dans les dialogues de l’éditeur et restituer leurs déclencheurs', async ({ page }) => {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  await register(page, suffix);
  await createProjectThroughWizard(page, `Clavier ${suffix}`);
  await page.getByRole('link', { name: 'Ouvrir l’éditeur →' }).click();
  await expect(page).toHaveURL(/\/editor\/[a-f0-9-]+$/);

  const aiTrigger = page.getByRole('button', { name: '✦ IA', exact: true });
  await aiTrigger.click();
  await expect(page.getByRole('dialog', { name: 'Proposer une modification' })).toBeVisible();
  for (let index = 0; index < 8; index += 1) await page.keyboard.press('Tab');
  await expectFocusInside(page, '.ai-modal');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(aiTrigger).toBeFocused();

  const historyTrigger = page.getByRole('button', { name: 'Historique', exact: true });
  await historyTrigger.click();
  await expect(page.getByRole('dialog', { name: 'Historique de la page' })).toBeVisible();
  await page.keyboard.press('Shift+Tab');
  await expectFocusInside(page, '.version-modal');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(historyTrigger).toBeFocused();

  await page.locator('[data-testid="editor-canvas"] [data-node-type="hero"]').first().click();
  const libraryTrigger = page.getByRole('button', { name: 'Bibliothèque de médias' });
  await libraryTrigger.click();
  await expect(page.getByRole('dialog', { name: 'Bibliothèque' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(libraryTrigger).toBeFocused();
});
