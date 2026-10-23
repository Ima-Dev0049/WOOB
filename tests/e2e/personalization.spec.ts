import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createProjectThroughWizard } from './project-wizard';

async function registerAndOpen(page: Page, email: string, projectName: string) {
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `10.83.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}` });
  await page.goto('/register');
  await page.getByLabel('Votre nom').fill('Personnalisation E2E');
  await page.getByLabel('Adresse email').fill(email);
  await page.getByLabel('Mot de passe').fill('mot-de-passe-e2e-tres-long');
  await page.getByRole('button', { name: 'Créer mon espace' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await createProjectThroughWizard(page, projectName);
  const projectId = page.url().split('/').pop()!;
  await page.getByRole('link', { name: 'Ouvrir l’éditeur →' }).click();
  await expect(page).toHaveURL(/\/editor\/[a-f0-9-]+$/);
  return { projectId, pageId: page.url().split('/').pop()! };
}

async function save(page: Page, pageId: string) {
  const response = page.waitForResponse((item) => item.url().includes(`/api/pages/${pageId}/document`) && item.request().method() === 'PUT' && item.status() === 200);
  await page.getByTestId('save-page').click();
  await response;
  await expect(page.locator('.save-indicator')).toHaveClass(/saved/);
}

async function addButton(page: Page) {
  await page.locator('.component-library').getByRole('button').filter({ hasText: 'Bouton' }).first().click();
}

test('presets, responsive, undo/redo, rechargement et publication utilisent le même style', async ({ page, browser }) => {
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const { projectId, pageId } = await registerAndOpen(page, `styles-${suffix}@example.com`, `Styles E2E ${suffix}`);
  await addButton(page);
  const firstButton = page.locator('[data-testid="editor-canvas"] [data-node-type="button"] > a.button').first();
  await expect(firstButton).toBeVisible();
  await page.locator('.style-toolbar-section input[id^="style-backgroundColor-"]').fill('#112233');
  await expect(firstButton).toHaveCSS('background-color', 'rgb(17, 34, 51)');
  await page.locator('.style-toolbar-section input[id^="style-borderRadius-"]').fill('23px');
  await expect(firstButton).toHaveCSS('border-radius', '23px');

  await page.getByTitle('Mobile', { exact: true }).click();
  await page.locator('.style-toolbar-section input[id^="style-width-"]').fill('100%');
  await expect(firstButton).toHaveAttribute('style', /width:\s*100%/);
  await page.getByTitle('Annuler (Ctrl+Z)').click();
  await expect(firstButton).not.toHaveAttribute('style', /width:/);
  await page.getByTitle('Rétablir (Ctrl+Shift+Z)').click();
  await expect(firstButton).toHaveAttribute('style', /width:\s*100%/);
  await page.getByTitle('Ordinateur', { exact: true }).click();
  await expect(firstButton).not.toHaveAttribute('style', /width:/);
  await page.getByTitle('Mobile', { exact: true }).click();

  await page.getByPlaceholder('Ex. Bouton arrondi de marque').fill('Bouton partagé E2E');
  await page.getByRole('button', { name: 'Enregistrer comme style réutilisable' }).click();
  const presetId = await page.locator('.reusable-styles select').inputValue();
  expect(presetId).toMatch(/^style-[a-f0-9-]+$/);
  await addButton(page);
  await page.locator('[data-testid="editor-canvas"] [data-node-type="button"]').first().click();
  await page.getByRole('button', { name: /Appliquer le préset aux blocs/ }).click();
  await page.locator('[data-testid="editor-canvas"] [data-node-type="button"]').nth(1).click();
  await expect(page.locator('.reusable-styles select')).toHaveValue(presetId);
  const secondButton = page.locator('[data-testid="editor-canvas"] [data-node-type="button"] > a.button').nth(1);
  await expect(secondButton).toHaveCSS('background-color', 'rgb(17, 34, 51)');
  await expect(secondButton).toHaveCSS('border-radius', '23px');
  await page.getByRole('button', { name: 'Copier le style' }).click();
  await page.getByRole('button', { name: 'Tout réinitialiser' }).click();
  await expect(page.locator('.reusable-styles select')).toHaveValue('');
  await page.getByRole('button', { name: 'Coller', exact: true }).click();
  await expect(page.locator('.reusable-styles select')).toHaveValue(presetId);
  await expect(secondButton).toHaveCSS('background-color', 'rgb(17, 34, 51)');
  await page.getByLabel('Mode éditeur').selectOption('expert');
  await page.getByText('Variables CSS expertes', { exact: true }).click();
  await page.getByLabel('Nouvelle variable CSS').fill('--woob-button-space');
  await page.getByLabel('Valeur de la nouvelle variable').fill('24px');
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await page.locator('.style-toolbar-section input[id^="style-padding-"]').fill('var(--woob-button-space)');
  await expect(secondButton).toHaveCSS('padding-top', '24px');
  await save(page, pageId);

  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-testid="editor-canvas"] [data-node-type="button"]').nth(1).click();
  await expect(page.locator('.reusable-styles select')).toHaveValue(presetId);
  await expect(page.locator('[data-testid="editor-canvas"] [data-node-type="button"] > a.button').nth(1)).toHaveCSS('padding-top', '11px');
  await page.getByTitle('Mobile', { exact: true }).click();
  await expect(page.locator('[data-testid="editor-canvas"] [data-node-type="button"] > a.button').nth(1)).toHaveCSS('padding-top', '24px');
  await page.getByRole('button', { name: '◐ Thème' }).click();
  await page.getByLabel('Couleur principale', { exact: true }).fill('#135724');
  await page.getByLabel('Couleur principale', { exact: true }).press('Enter');
  await expect(page.locator('.canvas-document')).toHaveAttribute('style', /--site-primary:\s*#135724/);
  await save(page, pageId);

  const publishResponse = page.waitForResponse((response) => response.url().includes(`/api/projects/${projectId}/publish`) && response.request().method() === 'POST' && response.status() === 201);
  await page.getByRole('button', { name: 'Publier', exact: true }).click();
  const published = await (await publishResponse).json() as { url: string };
  const anonymous = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const publicPage = await anonymous.newPage();
  await publicPage.goto(`http://127.0.0.1:3000${published.url}`);
  await expect(publicPage.locator('.published-site')).toHaveAttribute('style', /--site-primary:\s*#135724/);
  const publicButton = publicPage.locator('[data-node-type="button"] > a.button').nth(1);
  await expect(publicButton).toHaveCSS('background-color', 'rgb(17, 34, 51)');
  await expect(publicButton).toHaveCSS('border-radius', '23px');
  await expect(publicButton).toHaveCSS('padding-top', '24px');
  const widths = await publicButton.evaluate((element) => ({ button: element.getBoundingClientRect().width, wrapper: element.parentElement?.getBoundingClientRect().width ?? 0 }));
  expect(Math.abs(widths.button - widths.wrapper)).toBeLessThan(2);
  await anonymous.close();
  expect(errors).toEqual([]);
});

test('l’IA propose un thème prévisualisable, annulable et réversible', async ({ page }) => {
  const errors: string[] = []; const reactStyleWarnings: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'warning' && message.text().includes('Unsupported style property')) reactStyleWarnings.push(message.text()); });
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const { pageId } = await registerAndOpen(page, `theme-ai-${suffix}@example.com`, `Thème IA E2E ${suffix}`);
  const canvas = page.locator('.canvas-document');
  const originalStyle = await canvas.getAttribute('style');
  await page.getByRole('button', { name: '✦ IA' }).click();
  await page.getByLabel('Votre consigne').fill('Propose un thème sombre pour une marque technologique');
  await page.getByRole('button', { name: 'Générer une proposition' }).click();
  await expect(page.locator('.ai-result')).toBeVisible();
  await expect(page.locator('.ai-provider')).toHaveText('DÉMO LOCALE');
  await expect(page.locator('.ai-preview')).toHaveAttribute('style', /--site-primary:\s*#365CF5/);
  await expect(canvas).toHaveAttribute('style', originalStyle || '');
  await page.getByRole('button', { name: 'Annuler', exact: true }).click();
  await expect(page.locator('.ai-result')).toHaveCount(0);
  await expect(canvas).toHaveAttribute('style', originalStyle || '');

  await page.getByRole('button', { name: 'Générer une proposition' }).click();
  await expect(page.locator('.ai-result')).toBeVisible();
  await page.getByRole('button', { name: 'Appliquer au brouillon' }).click();
  await expect(page.locator('.ai-modal')).toHaveCount(0);
  await expect(canvas).toHaveAttribute('style', /--site-primary:\s*#365CF5/);
  await page.getByTitle('Annuler (Ctrl+Z)').click();
  await expect(canvas).toHaveAttribute('style', originalStyle || '');
  await page.getByTitle('Rétablir (Ctrl+Shift+Z)').click();
  await expect(canvas).toHaveAttribute('style', /--site-primary:\s*#365CF5/);
  await save(page, pageId);
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.locator('.canvas-document')).toHaveAttribute('style', /--site-primary:\s*#365CF5/);
  await page.getByRole('button', { name: '◐ Thème' }).click();
  await expect(page.getByLabel('Mode de couleur')).toHaveValue('dark');
  expect(reactStyleWarnings).toEqual([]);
  expect(errors).toEqual([]);
});

test('les panneaux avancés et expert ouverts ne produisent pas de violation axe', async ({ page }) => {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  await registerAndOpen(page, `a11y-styles-${suffix}@example.com`, `Accessibilité styles ${suffix}`);
  await page.locator('[data-testid="editor-canvas"] [data-node-type="hero"]').first().click();
  await page.getByLabel('Mode éditeur').selectOption('expert');
  await page.locator('.editor-right details > summary').evaluateAll((summaries) => summaries.forEach((summary) => { (summary.parentElement as HTMLDetailsElement).open = true; }));
  let result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(result.violations).toEqual([]);
  await page.getByRole('button', { name: '◐ Thème' }).click();
  await page.getByText('Couleurs étendues et mode sombre', { exact: true }).click();
  await page.getByLabel('Mode de couleur').selectOption('auto');
  await page.locator('.editor-right details > summary').evaluateAll((summaries) => summaries.forEach((summary) => { (summary.parentElement as HTMLDetailsElement).open = true; }));
  result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(result.violations).toEqual([]);
});
