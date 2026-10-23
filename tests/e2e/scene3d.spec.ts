import { test, expect, type Page } from '@playwright/test';
import { createProjectThroughWizard } from './project-wizard';

async function register(page: Page, email: string) {
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `10.93.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}` });
  await page.goto('/register');
  await page.getByLabel('Votre nom').fill('Scène 3D E2E');
  await page.getByLabel('Adresse email').fill(email);
  await page.getByLabel('Mot de passe').fill('mot-de-passe-e2e-tres-long');
  await page.getByRole('button', { name: 'Créer mon espace' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function generateSceneProposal(page: Page, pageId: string) {
  const response = page.waitForResponse((candidate) => candidate.url().includes(`/api/pages/${pageId}/ai`) && candidate.request().method() === 'POST');
  await page.getByRole('button', { name: 'Générer une proposition', exact: true }).click();
  expect((await response).ok()).toBe(true);
}

test('la démo 3D initialise Three.js, répond aux contrôles et suspend sa boucle hors viewport', async ({ page }) => {
  await page.goto('/demos/atelier-ligne/projets');
  const scene = page.getByTestId('scene3d');
  const stage = page.getByTestId('scene3d-stage');
  await scene.scrollIntoViewIfNeeded();
  await expect(scene).toHaveAttribute('data-scene3d-state', 'ready', { timeout: 30_000 });
  await expect(stage.locator('canvas')).toBeVisible();
  await expect(stage).toHaveAttribute('data-scene-engine', 'three');
  await expect(stage).toHaveAttribute('data-scene-running', 'true');

  await page.getByRole('button', { name: 'Tourner la scène à droite', exact: true }).click();
  await expect(stage).toHaveAttribute('data-scene-rotation', /0\.393/);
  await page.getByRole('button', { name: 'Mettre en pause', exact: true }).click();
  await expect(scene).toHaveAttribute('data-scene3d-paused', 'true');
  await expect(stage).toHaveAttribute('data-scene-running', 'false');
  await page.getByRole('button', { name: 'Reprendre la rotation', exact: true }).click();
  await expect(stage).toHaveAttribute('data-scene-running', 'true');
  await scene.screenshot({ path: 'test-results/scene3d-desktop.png' });

  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(stage).toHaveAttribute('data-scene-running', 'false');
  await page.setViewportSize({ width: 390, height: 844 });
  await scene.scrollIntoViewIfNeeded();
  await expect(stage).toHaveAttribute('data-scene-running', 'true');
  const dimensions = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
  await scene.screenshot({ path: 'test-results/scene3d-mobile.png' });
});

test('reduced-motion conserve le contenu et le fallback sans initialiser de canvas', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/demos/atelier-ligne/projets');
  const scene = page.getByTestId('scene3d');
  await scene.scrollIntoViewIfNeeded();
  await expect(scene).toHaveAttribute('data-scene3d-state', 'fallback');
  await expect(scene).toHaveAttribute('data-scene3d-fallback-reason', 'reduced-motion');
  await expect(scene.getByRole('heading', { name: 'Orbite 01 — une étude en volume' })).toBeVisible();
  await expect(page.getByTestId('scene3d-fallback')).toBeVisible();
  await expect(page.getByTestId('scene3d-fallback').locator('img')).toBeVisible();
  await expect(page.getByTestId('scene3d-stage').locator('canvas')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Mettre en pause', exact: true })).toHaveCount(0);
});

test('la proposition IA 3D reste annulable puis se persiste et se publie avec undo/redo', async ({ page }) => {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  await register(page, `scene3d-${suffix}@example.com`);
  await createProjectThroughWizard(page, `Projet scène 3D ${suffix}`);
  const projectId = page.url().split('/').pop()!;
  await page.getByRole('link', { name: 'Ouvrir l’éditeur →' }).click();
  await expect(page).toHaveURL(/\/editor\/[a-f0-9-]+$/);
  const pageId = page.url().split('/').pop()!;
  const canvasScene = page.getByTestId('editor-canvas').getByTestId('scene3d');
  await expect(canvasScene).toHaveCount(0);

  await page.getByRole('button', { name: '✦ IA', exact: true }).click();
  await page.getByLabel('Votre consigne').fill('Ajoute une scène 3D orbitale économe');
  await generateSceneProposal(page, pageId);
  const previewScene = page.locator('.ai-preview').getByTestId('scene3d');
  await previewScene.scrollIntoViewIfNeeded();
  await expect(previewScene).toBeVisible();
  await expect(canvasScene).toHaveCount(0);
  await page.locator('.ai-proposal-actions').getByRole('button', { name: 'Annuler', exact: true }).click();
  await expect(previewScene).toHaveCount(0);
  await expect(canvasScene).toHaveCount(0);

  await generateSceneProposal(page, pageId);
  await page.getByRole('button', { name: 'Appliquer au brouillon', exact: true }).click();
  await expect(canvasScene).toHaveCount(1);
  await page.getByTitle('Annuler (Ctrl+Z)').click();
  await expect(canvasScene).toHaveCount(0);
  await page.getByTitle('Rétablir (Ctrl+Shift+Z)').click();
  await expect(canvasScene).toHaveCount(1);
  await canvasScene.scrollIntoViewIfNeeded();
  await expect(canvasScene).toHaveAttribute('data-scene3d-state', 'ready', { timeout: 30_000 });
  await expect(canvasScene.getByTestId('scene3d-stage')).toHaveAttribute('data-scene-running', 'false');

  const title = `Scène IA persistante ${suffix}`;
  await canvasScene.locator('.scene3d-copy').click();
  await page.getByTestId('field-title').fill(title);
  await page.getByTestId('field-preset').selectOption('prism');
  await page.getByTestId('field-quality').selectOption('balanced');
  await page.getByTestId('field-interactive').uncheck();
  const saveResponse = page.waitForResponse((response) => response.url().includes(`/api/pages/${pageId}/document`) && response.request().method() === 'PUT' && response.status() === 200);
  await page.getByTestId('save-page').click();
  await saveResponse;
  await expect(page.locator('.save-indicator')).toHaveClass(/saved/);
  await page.reload({ waitUntil: 'networkidle' });
  const persistedScene = page.getByTestId('editor-canvas').getByTestId('scene3d');
  await persistedScene.locator('.scene3d-copy').click();
  await expect(page.getByTestId('field-title')).toHaveValue(title);
  await expect(page.getByTestId('field-preset')).toHaveValue('prism');
  await expect(page.getByTestId('field-quality')).toHaveValue('balanced');
  await expect(page.getByTestId('field-interactive')).not.toBeChecked();

  const publishResponse = page.waitForResponse((response) => response.url().includes(`/api/projects/${projectId}/publish`) && response.request().method() === 'POST' && response.status() === 201);
  await page.getByRole('button', { name: 'Publier', exact: true }).click();
  const published = await (await publishResponse).json() as { url: string };
  await page.goto(published.url);
  const publicScene = page.getByTestId('scene3d');
  await publicScene.scrollIntoViewIfNeeded();
  await expect(publicScene).toHaveAttribute('data-scene3d-state', 'ready', { timeout: 30_000 });
  await expect(publicScene.getByRole('heading', { name: title })).toBeVisible();
  await expect(publicScene).toHaveAttribute('data-scene3d-preset', 'prism');
  await expect(publicScene.getByTestId('scene3d-stage')).toHaveAttribute('data-scene-running', 'true');
  await expect(publicScene.getByRole('button', { name: 'Mettre en pause', exact: true })).toBeVisible();
  await expect(publicScene.getByRole('button', { name: 'Tourner la scène à droite', exact: true })).toHaveCount(0);
});
