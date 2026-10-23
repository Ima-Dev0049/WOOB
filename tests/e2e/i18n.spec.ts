import { test, expect } from '@playwright/test';

test('appliquer et conserver la langue anglaise dans le dashboard et après déconnexion', async ({ page }) => {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const email = `i18n-${suffix}@example.com`;
  const password = 'mot-de-passe-i18n-tres-long';
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `10.46.0.${Math.floor(Math.random() * 200) + 1}` });
  await page.goto('/register');
  await page.getByLabel('Votre nom').fill('I18n Test');
  await page.getByLabel('Adresse email').fill(email);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Créer mon espace' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator('.app-layout')).toHaveAttribute('lang', 'fr');

  await page.getByRole('link', { name: 'Paramètres', exact: true }).click();
  await page.getByLabel('Langue de l’interface').selectOption('en');
  const saveResponse = page.waitForResponse((response) => response.url().endsWith('/api/auth/me') && response.request().method() === 'PATCH' && response.status() === 200);
  await page.getByRole('button', { name: 'Enregistrer les préférences' }).click();
  await saveResponse;
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Profile and preferences' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Preferences saved.');
  await expect(page.locator('.app-layout')).toHaveAttribute('lang', 'en');

  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  await expect(page.getByLabel('Interface language')).toHaveValue('en');
  await page.getByRole('link', { name: 'Overview', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Hello, I18n.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your projects', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /New project/ }).first().click();
  await expect(page.getByLabel('Project name')).toBeVisible();
  await page.getByRole('button', { name: /Skip straight to the description/ }).click();
  await expect(page.getByRole('button', { name: 'Generate preview →' })).toBeVisible();
  await expect(page.getByLabel('Content language')).toHaveValue('en');
  await page.getByRole('button', { name: 'Close', exact: true }).click();

  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator('.auth-layout')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { name: 'Good to see you again.' })).toBeVisible();
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Hello, I18n.' })).toBeVisible();
});
