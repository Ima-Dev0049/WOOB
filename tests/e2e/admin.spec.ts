import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createProjectThroughWizard } from './project-wizard';

const password = 'mot-de-passe-e2e-tres-long';
const adminEmail = 'platform-admin-e2e@example.com';

function isolateIp(page: Page) {
  return page.setExtraHTTPHeaders({ 'x-forwarded-for': `10.90.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}` });
}
async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Adresse email').fill(email);
  await page.getByLabel('Mot de passe').fill(password);
  const response = page.waitForResponse((item) => item.url().endsWith('/api/auth/login'));
  await page.getByRole('button', { name: 'Se connecter' }).click();
  expect((await response).status()).toBe(200);
  await expect(page).toHaveURL(/\/dashboard$/);
}
async function register(page: Page, name: string, email: string) {
  await page.goto('/register');
  await page.getByLabel('Votre nom').fill(name);
  await page.getByLabel('Adresse email').fill(email);
  await page.getByLabel('Mot de passe').fill(password);
  const response = page.waitForResponse((item) => item.url().endsWith('/api/auth/register'));
  await page.getByRole('button', { name: 'Créer mon espace' }).click();
  expect((await response).status()).toBe(201);
  await expect(page).toHaveURL(/\/dashboard$/);
}
async function ensureAdmin(page: Page) {
  await isolateIp(page);
  await page.goto('/login');
  await page.getByLabel('Adresse email').fill(adminEmail);
  await page.getByLabel('Mot de passe').fill(password);
  const response = page.waitForResponse((item) => item.url().endsWith('/api/auth/login'));
  await page.getByRole('button', { name: 'Se connecter' }).click();
  if ((await response).status() === 401) await register(page, 'Platform Admin E2E', adminEmail);
  else await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('link', { name: 'Administration' })).toBeVisible();
}
async function createProject(page: Page, name: string) {
  await createProjectThroughWizard(page, name);
}
async function acceptNextDialog(page: Page) {
  page.once('dialog', (dialog) => dialog.accept());
}
async function audit(page: Page) {
  await expect(page.locator('[data-route-motion="native"]')).toHaveAttribute('data-route-state', 'entered');
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return result.violations.map((violation) => ({ id: violation.id, impact: violation.impact, nodes: violation.nodes.map((node) => ({ target: node.target, summary: node.failureSummary })) }));
}

test('un owner ordinaire ne peut ni voir ni appeler l’administration, même avec CSRF', async ({ page }) => {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  await isolateIp(page);
  await register(page, 'Owner sans privilège', `ordinary-admin-${suffix}@example.com`);
  await expect(page.getByRole('link', { name: 'Administration' })).toHaveCount(0);
  const me = await page.request.get('/api/auth/me');
  expect(me.status()).toBe(200);
  const identity = await me.json();
  expect(identity.user.passwordHash).toBeUndefined();
  expect(identity.user.normalizedEmail).toBeUndefined();
  expect((await page.request.get('/api/admin/stats')).status()).toBe(403);
  const withoutCsrf = await page.request.patch(`/api/admin/users/${identity.user.id}`, { data: { action: 'set_role', role: 'admin' } });
  expect(withoutCsrf.status()).toBe(403);
  expect((await withoutCsrf.json()).error.code).toBe('CSRF_REJECTED');
  const csrf = (await page.context().cookies()).find((cookie) => cookie.name === 'woob_csrf')!.value;
  const withCsrf = await page.request.patch(`/api/admin/users/${identity.user.id}`, { headers: { 'x-csrf-token': csrf }, data: { action: 'set_role', role: 'admin' } });
  expect(withCsrf.status()).toBe(403);
  expect((await withCsrf.json()).error.code).toBe('PLATFORM_ADMIN_REQUIRED');
  const response = await page.goto('/admin');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Administration Woob' })).toHaveCount(0);
});

test('un administrateur suspend et réactive un compte, puis attribue une offre manuellement', async ({ page, browser }) => {
  test.setTimeout(120_000);
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const targetName = `Cible compte ${suffix}`;
  const targetEmail = `target-account-${suffix}@example.com`;
  await ensureAdmin(page);
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Administration Woob' })).toBeVisible();
  expect(await audit(page)).toEqual([]);
  const targetContext = await browser.newContext();
  const targetPage = await targetContext.newPage();
  try {
    await isolateIp(targetPage);
    await register(targetPage, targetName, targetEmail);
    await page.reload();
    await page.getByLabel('Rechercher un compte, un espace ou un projet').fill(targetEmail);
    await acceptNextDialog(page);
    const suspendResponse = page.waitForResponse((response) => response.url().includes('/api/admin/users/') && response.request().method() === 'PATCH' && response.status() === 200);
    await page.getByRole('button', { name: `Suspendre ${targetName}`, exact: true }).click();
    await suspendResponse;
    await expect(page.getByRole('button', { name: `Réactiver ${targetName}`, exact: true })).toBeVisible();
    await targetPage.reload();
    await expect(targetPage).toHaveURL(/\/login$/);

    await acceptNextDialog(page);
    const reactivateResponse = page.waitForResponse((response) => response.url().includes('/api/admin/users/') && response.request().method() === 'PATCH' && response.status() === 200);
    await page.getByRole('button', { name: `Réactiver ${targetName}`, exact: true }).click();
    await reactivateResponse;
    await expect(page.getByRole('button', { name: `Suspendre ${targetName}`, exact: true })).toBeVisible();
    await login(targetPage, targetEmail);
    const workspaceName = `Espace de ${targetName}`;
    const planSelect = page.getByRole('combobox', { name: `Offre de ${workspaceName}` });
    await planSelect.selectOption({ label: 'Professionnel' });
    await acceptNextDialog(page);
    const planResponse = page.waitForResponse((response) => response.url().includes('/api/admin/workspaces/') && response.request().method() === 'PATCH' && response.status() === 200);
    const applyPlan = page.getByRole('button', { name: `Appliquer l’offre ${workspaceName}` });
    await applyPlan.click();
    await planResponse;
    await expect(page.getByRole('button', { name: `Appliquer l’offre ${workspaceName}` })).toBeDisabled();
    await expect(page.locator('#audit').getByText('user.status', { exact: true }).first()).toBeVisible();
    await expect(page.locator('#audit').getByText('workspace.plan', { exact: true }).first()).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('heading', { name: 'Administration Woob' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  } finally {
    await targetContext.close();
  }
});

test('la modération workspace et projet prend effet dans le navigateur et se réactive', async ({ page, browser }) => {
  test.setTimeout(120_000);
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const targetName = `Cible modération ${suffix}`;
  const targetEmail = `target-moderation-${suffix}@example.com`;
  const projectName = `Projet modéré ${suffix}`;
  const workspaceName = `Espace de ${targetName}`;
  await ensureAdmin(page);
  const targetContext = await browser.newContext();
  const targetPage = await targetContext.newPage();
  try {
    await isolateIp(targetPage);
    await register(targetPage, targetName, targetEmail);
    await createProject(targetPage, projectName);
    await page.goto('/admin');
    await page.getByLabel('Rechercher un compte, un espace ou un projet').fill(projectName);
    await acceptNextDialog(page);
    let response = page.waitForResponse((item) => item.url().includes('/api/admin/projects/') && item.request().method() === 'PATCH' && item.status() === 200);
    await page.getByRole('button', { name: `Suspendre ${projectName}`, exact: true }).click();
    await response;
    await expect(page.getByRole('button', { name: `Réactiver ${projectName}`, exact: true })).toBeVisible();
    await targetPage.reload();
    expect((await targetPage.request.get(targetPage.url())).status()).toBe(404);

    await acceptNextDialog(page);
    response = page.waitForResponse((item) => item.url().includes('/api/admin/projects/') && item.request().method() === 'PATCH' && item.status() === 200);
    await page.getByRole('button', { name: `Réactiver ${projectName}`, exact: true }).click();
    await response;
    await expect(page.getByRole('button', { name: `Suspendre ${projectName}`, exact: true })).toBeVisible();
    await targetPage.reload();
    await expect(targetPage.getByRole('heading', { name: projectName })).toBeVisible();

    await page.getByLabel('Rechercher un compte, un espace ou un projet').fill(targetEmail);
    await acceptNextDialog(page);
    response = page.waitForResponse((item) => item.url().includes('/api/admin/workspaces/') && item.request().method() === 'PATCH' && item.status() === 200);
    await page.getByRole('button', { name: `Suspendre ${workspaceName}`, exact: true }).click();
    await response;
    await expect(page.getByRole('button', { name: `Réactiver ${workspaceName}`, exact: true })).toBeVisible();
    await targetPage.reload();
    await expect(targetPage).toHaveURL(/\/login$/);

    await acceptNextDialog(page);
    response = page.waitForResponse((item) => item.url().includes('/api/admin/workspaces/') && item.request().method() === 'PATCH' && item.status() === 200);
    await page.getByRole('button', { name: `Réactiver ${workspaceName}`, exact: true }).click();
    await response;
    await expect(page.getByRole('button', { name: `Suspendre ${workspaceName}`, exact: true })).toBeVisible();
    await targetPage.goto('/dashboard');
    await expect(targetPage.getByText(projectName, { exact: true }).first()).toBeVisible();
  } finally {
    await targetContext.close();
  }
});
