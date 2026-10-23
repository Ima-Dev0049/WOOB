import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createProjectThroughWizard } from './project-wizard';

test('le préflight affiche un avertissement, laisse décider puis publie la version contrôlée', async ({ page, browser }) => {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `10.97.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}` });
  await page.goto('/register');
  await page.getByLabel('Votre nom').fill('Publication Preflight E2E');
  await page.getByLabel('Adresse email').fill(`publication-preflight-${suffix}@example.com`);
  await page.getByLabel('Mot de passe').fill('mot-de-passe-e2e-tres-long');
  await page.getByRole('button', { name: 'Créer mon espace' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await createProjectThroughWizard(page, `Préflight ${suffix}`);
  const projectId = page.url().split('/').pop()!;
  await page.getByRole('link', { name: 'Ouvrir l’éditeur →' }).click();
  await expect(page).toHaveURL(/\/editor\/[a-f0-9-]+$/);
  const pageId = page.url().split('/').pop()!;

  await page.locator('.editor-left-tabs').getByRole('button', { name: /Pages/ }).click();
  await page.getByText('SEO de la page actuelle', { exact: true }).click();
  await page.getByRole('textbox', { name: 'Description SEO', exact: true }).fill('');
  const metadataResponse = page.waitForResponse((response) => response.url().includes(`/api/pages/${pageId}`) && response.request().method() === 'PATCH' && response.status() === 200);
  const reloaded = page.waitForNavigation({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Enregistrer le SEO', exact: true }).click();
  await Promise.all([metadataResponse, reloaded]);

  const preflightResponse = page.waitForResponse((response) => response.url().includes(`/api/projects/${projectId}/publication-preflight`) && response.request().method() === 'GET' && response.status() === 200);
  await page.getByRole('button', { name: 'Publier', exact: true }).click();
  const report = await (await preflightResponse).json() as { status: string; issues: { severity: string; message: string }[] };
  expect(report.status).toBe('warnings');
  expect(report.issues.some((issue) => issue.severity === 'warning' && issue.message.includes('description SEO'))).toBe(true);
  const dialog = page.getByTestId('publication-preflight');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('1 avertissement');
  await expect(dialog).toContainText('n’a pas de description SEO');
  await expect(dialog).toContainText('Ce rapport n’est ni un audit Lighthouse ni une mesure de LCP');
  await expect.poll(() => dialog.evaluate((element) => element.getAnimations().length)).toBe(0);
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).include('[data-testid="publication-preflight"]').analyze();
  expect(accessibility.violations).toEqual([]);
  await page.screenshot({ path: 'test-results/publication-preflight.png' });

  const publishResponse = page.waitForResponse((response) => response.url().includes(`/api/projects/${projectId}/publish`) && response.request().method() === 'POST' && response.status() === 201);
  await dialog.getByRole('button', { name: 'Publier avec 1 avertissement', exact: true }).click();
  const published = await (await publishResponse).json() as { url: string; preflight: { status: string } };
  expect(published.preflight.status).toBe('warnings');
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.editor-toast')).toContainText('1 avertissement');
  const anonymous = await browser.newContext();
  const publicPage = await anonymous.newPage();
  await publicPage.goto(`http://127.0.0.1:3000${published.url}`);
  await expect(publicPage.locator('.published-site h1').first()).toBeVisible();
  await anonymous.close();
});
