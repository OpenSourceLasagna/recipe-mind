import { test, expect } from '@playwright/test';
import { loginAndNavigate } from '../helpers/auth.helper';
import { setupApiMocks } from '../helpers/api.helper';

test.describe('Mobile Debug', () => {
  test('debug store state after send', async ({ page }) => {
    await setupApiMocks(page, { withRecipeDetail: true, withAiDraft: true });
    await loginAndNavigate(page, '/dashboard/explore');
    await page.waitForLoadState('networkidle');

    const chatToggle = page.locator('app-chat-button button');
    await chatToggle.click();

    await page.waitForSelector('app-chat-panel', {
      state: 'attached',
      timeout: 5000,
    });

    const input = page.getByRole('textbox', { name: 'Ask the AI Chef...' });
    await input.fill('Make carbonara healthier');
    await page.locator('app-chat-panel button[aria-label="Send message"]').last().click();
    await page.waitForTimeout(3000);

    // Read store state from Angular
    const storeState = await page.evaluate(() => {
      const el = document.querySelector('app-root');
      if (!el) return 'NO APP ROOT';

      // Try to access the chat store via injector
      const win = window as any;
      // Angular 21 might not expose globals

      // Alternative: check component instances
      const chatMsgs = document.querySelectorAll('app-chat-message');
      const results = [];
      chatMsgs.forEach((el, i) => {
        // Check for any ng attributes
        const ngAttrs = Array.from(el.attributes)
          .filter((a) => a.name.startsWith('_nghost') || a.name.startsWith('ng-'))
          .map((a) => a.name);
        results.push(
          `Msg ${i}: hasDraft=${el.innerHTML.includes('recipeDraft')}, text=${(el as HTMLElement).innerText.substring(0, 60)}`,
        );
      });
      return results.join('\n');
    });

    console.log('=== Store State ===');
    console.log(storeState);

    // Also check: does the mock result appear in visible text?
    const visibleText = await page.locator('app-chat-panel').last().innerText();
    console.log('=== Visible Text in last panel ===');
    console.log(visibleText);
  });
});
