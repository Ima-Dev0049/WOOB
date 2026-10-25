import { expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** Audit stable UI colors, after the native route entrance has released its opacity. */
export async function expectApplicationAccessible(page: Page) {
  await expect(page.locator('[data-route-motion="native"]')).toHaveAttribute('data-route-state', 'entered');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
}
