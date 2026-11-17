import { expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Audit stable UI colors, after the native route entrance has released its opacity.
 * The title is awaited first: Next can append streamed metadata after the visible
 * shell, and auditing before it lands reported a false `document-title` violation.
 */
export async function expectApplicationAccessible(page: Page) {
  await expect(page.locator('[data-route-motion="native"]')).toHaveAttribute('data-route-state', 'entered');
  await expect.poll(() => page.title(), { message: 'le document doit avoir un titre non vide' }).not.toBe('');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
}
