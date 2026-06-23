import { test, expect } from '@playwright/test';
import { loginAndNavigate } from '../helpers/auth.helper';
import { setupApiMocks } from '../helpers/api.helper';

const RECIPE_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

test.describe('Recipe AI Diff', () => {
  test('displays recipe title in detail view', async ({ page }) => {
    await setupApiMocks(page, { withRecipeDetail: true, withAiDraft: true });
    await loginAndNavigate(page, `/dashboard/recipes/${RECIPE_ID}`);
    await page.waitForSelector('app-recipe-detail-view', {
      state: 'attached',
      timeout: 15000,
    });
    await expect(page.locator('h1')).toContainText('Classic Pasta Carbonara');
  });

  test('version toggle is hidden when no changes exist', async ({ page }) => {
    await setupApiMocks(page, { withRecipeDetail: true, withAiDraft: true });
    await loginAndNavigate(page, `/dashboard/recipes/${RECIPE_ID}`);
    await page.waitForSelector('app-recipe-detail-view', {
      state: 'attached',
      timeout: 15000,
    });
    const toggle = page.locator('[aria-label="Recipe version"]');
    await expect(toggle).not.toBeAttached();
  });

  test('shows diff annotations and save/dismiss footer after AI draft', async ({ page }) => {
    await setupApiMocks(page, { withRecipeDetail: true, withAiDraft: true });
    await loginAndNavigate(page, `/dashboard/recipes/${RECIPE_ID}`);
    await page.waitForSelector('app-recipe-detail-view', {
      state: 'attached',
      timeout: 15000,
    });
    await page.click('button[aria-label="Open AI Chef"]');
    await page.waitForSelector('app-chat-panel', {
      state: 'attached',
      timeout: 5000,
    });

    const input = page.locator('app-chat-panel input[type="text"]');
    await input.fill('Make this recipe lighter');
    await page.click('app-chat-panel button[aria-label="Send message"]');

    const toggle = page.locator('[aria-label="Recipe version"]');
    await toggle.waitFor({ state: 'attached', timeout: 10000 });

    const changesBtn = toggle.locator('button').last();
    await changesBtn.click();

    await expect(
      page.locator('app-recipe-detail-view .rounded-full.bg-amber-50').first(),
    ).toBeVisible();

    await expect(page.locator('app-recipe-detail-view li.bg-emerald-50').first()).toBeVisible();

    await expect(page.locator('h1 span.text-emerald-600')).toBeVisible();

    const saveBtn = page.locator('app-recipe-detail-view button:has-text("Save as Copy")');
    await expect(saveBtn).toBeVisible();

    const dismissBtn = page.locator('app-recipe-detail-view button:has-text("Dismiss Changes")');
    await expect(dismissBtn).toBeVisible();
  });

  test('dismiss changes clears diff and hides footer', async ({ page }) => {
    await setupApiMocks(page, { withRecipeDetail: true, withAiDraft: true });
    await loginAndNavigate(page, `/dashboard/recipes/${RECIPE_ID}`);
    await page.waitForSelector('app-recipe-detail-view', {
      state: 'attached',
      timeout: 15000,
    });
    await page.click('button[aria-label="Open AI Chef"]');
    await page.waitForSelector('app-chat-panel', {
      state: 'attached',
      timeout: 5000,
    });

    const input = page.locator('app-chat-panel input[type="text"]');
    await input.fill('Modify this recipe');
    await page.click('app-chat-panel button[aria-label="Send message"]');

    const toggle = page.locator('[aria-label="Recipe version"]');
    await toggle.waitFor({ state: 'attached', timeout: 10000 });

    const changesBtn = toggle.locator('button').last();
    await changesBtn.click();

    const dismissBtn = page.locator('app-recipe-detail-view button:has-text("Dismiss Changes")');
    await expect(dismissBtn).toBeVisible();
    await dismissBtn.click();
    await expect(dismissBtn).toBeHidden();

    await expect(
      page.locator('app-recipe-detail-view button:has-text("Save as Copy")'),
    ).not.toBeVisible();
    await expect(
      page.locator('app-recipe-detail-view button:has-text("Dismiss Changes")'),
    ).not.toBeVisible();
  });

  test('shows compact notification in chat for active recipe draft', async ({ page }) => {
    await setupApiMocks(page, { withRecipeDetail: true, withAiDraft: true });
    await loginAndNavigate(page, `/dashboard/recipes/${RECIPE_ID}`);
    await page.waitForSelector('app-recipe-detail-view', {
      state: 'attached',
      timeout: 15000,
    });
    await page.click('button[aria-label="Open AI Chef"]');
    await page.waitForSelector('app-chat-panel', {
      state: 'attached',
      timeout: 5000,
    });

    const input = page.locator('app-chat-panel input[type="text"]');
    await input.fill('Modify this recipe');
    await page.click('app-chat-panel button[aria-label="Send message"]');

    await expect(page.locator('text=Recipe updated')).toBeVisible({
      timeout: 10000,
    });
  });

  test('spawns single recipe message with changes (no duplicate)', async ({ page }) => {
    await setupApiMocks(page, { withRecipeDetail: true, withAiDraft: true });
    await loginAndNavigate(page, '/dashboard/explore');
    await page.waitForLoadState('networkidle');

    const chatToggle = page.locator('app-chat-button button');
    await chatToggle.click();

    await page.waitForSelector('app-chat-panel', {
      state: 'attached',
      timeout: 5000,
    });

    const input = page.locator('app-chat-panel input[type="text"]');
    await input.fill('Make carbonara healthier');
    await page.click('app-chat-panel button[aria-label="Send message"]');

    const recipeMessages = page.locator('app-recipe-message');
    await recipeMessages.first().waitFor({ state: 'attached', timeout: 10000 });
    await expect(recipeMessages).toHaveCount(1);

    await expect(recipeMessages.locator('hlm-badge:has-text("Active")')).toBeVisible();
    await expect(recipeMessages.locator('hlm-badge:has-text("Modified")')).toBeVisible();
    await expect(recipeMessages.locator('text=Save as Copy')).toBeVisible();
    await expect(recipeMessages.locator('text=Dismiss Changes')).toBeVisible();

    await expect(page.locator('app-recipe-message [data-testid="chat-recipe-detail"]')).toHaveCount(
      1,
    );
  });

  test('dismiss changes removes diff view and footer bar', async ({ page }) => {
    await setupApiMocks(page, { withRecipeDetail: true, withAiDraft: true });
    await loginAndNavigate(page, '/dashboard/explore');
    await page.waitForLoadState('networkidle');

    const chatToggle = page.locator('app-chat-button button');
    await chatToggle.click();

    await page.waitForSelector('app-chat-panel', {
      state: 'attached',
      timeout: 5000,
    });

    const input = page.locator('app-chat-panel input[type="text"]');
    await input.fill('Make carbonara healthier');
    await page.click('app-chat-panel button[aria-label="Send message"]');

    const dismissBtn = page.locator('text=Dismiss Changes');
    await dismissBtn.waitFor({ state: 'visible', timeout: 10000 });
    await dismissBtn.click();

    await expect(dismissBtn).toBeHidden();

    await expect(page.locator('text=Save as Copy')).not.toBeVisible();
    await expect(page.locator('text=Dismiss Changes')).not.toBeVisible();
  });

  test('collapsed recipe shows expand toggle in header', async ({ page }) => {
    await setupApiMocks(page, { withRecipeDetail: true, withAiDraft: true });
    await loginAndNavigate(page, '/dashboard/explore');
    await page.waitForLoadState('networkidle');

    const chatToggle = page.locator('app-chat-button button');
    await chatToggle.click();

    await page.waitForSelector('app-chat-panel', {
      state: 'attached',
      timeout: 5000,
    });

    const input = page.locator('app-chat-panel input[type="text"]');
    await input.fill('Make carbonara healthier');
    await page.click('app-chat-panel button[aria-label="Send message"]');

    const recipeMessage = page.locator('app-recipe-message');
    await recipeMessage.first().waitFor({ state: 'visible', timeout: 10000 });

    const chevron = recipeMessage.locator('button[aria-label="Collapse recipe"]');
    await expect(chevron).toBeVisible();
    await chevron.click();
    await expect(recipeMessage.locator('button[aria-label="Expand recipe"]')).toBeVisible();

    const expandBtn = recipeMessage.locator('button[aria-label="Expand recipe"]');
    await expandBtn.click();
    await expect(recipeMessage.locator('button[aria-label="Collapse recipe"]')).toBeVisible();
  });

  test('shows recipe draft card with View Changes button', async ({ page }) => {
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

    const viewChangesBtn = page.locator('app-chat-panel button:has-text("View Changes")');
    await viewChangesBtn.waitFor({ state: 'visible', timeout: 10000 });
    await expect(viewChangesBtn).toBeVisible();

    await expect(page.locator('text=Lighter Pasta Carbonara')).toBeVisible();
    await expect(page.locator('text=9 changes')).toBeVisible();
  });

  test('clicking View Changes expands recipe inline', async ({ page }) => {
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

    const viewChangesBtn = page.locator('app-chat-panel button:has-text("View Changes")');
    await viewChangesBtn.waitFor({ state: 'visible', timeout: 10000 });
    await viewChangesBtn.click();

    const recipeMessage = page.locator('app-recipe-message');
    await recipeMessage.first().waitFor({ state: 'attached', timeout: 10000 });

    await expect(recipeMessage.locator('hlm-badge:has-text("Modified")')).toBeVisible();
    await expect(recipeMessage.locator('text=Save as Copy')).toBeVisible();
    await expect(recipeMessage.locator('text=Dismiss Changes')).toBeVisible();
  });
});
