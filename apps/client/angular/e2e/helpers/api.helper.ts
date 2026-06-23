import { Page, Route } from '@playwright/test';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const FIXTURES_DIR = resolve(__dirname, '..', 'fixtures');

function loadFixture(name: string): string {
  return readFileSync(resolve(FIXTURES_DIR, name), 'utf-8');
}

export async function mockRecipeDetail(
  page: Page,
  fixtureFile = 'recipe-detail.json',
): Promise<void> {
  const data = JSON.parse(loadFixture(fixtureFile));
  const recipeId = data.id;

  await page.route(`**/v1/recipes/${recipeId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(data),
    });
  });

  await page.route('**/v1/recipes/*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(data),
    });
  });
}

export async function mockAiChefStream(
  page: Page,
  fixtureFile = 'sse-draft-response.txt',
): Promise<void> {
  const sseBody = loadFixture(fixtureFile);

  await page.route('**/v1/ai-chef/chat', async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
      body: sseBody,
    });
  });
}

export async function mockRecipeSearch(page: Page): Promise<void> {
  await page.route('**/v1/search*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
      }),
    });
  });
}

export async function mockRecipeCategories(page: Page): Promise<void> {
  await page.route('**/v1/search/categories*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });
}

export async function setupApiMocks(
  page: Page,
  options: {
    withRecipeDetail?: boolean;
    withAiDraft?: boolean;
    withAiSearch?: boolean;
  } = {},
): Promise<void> {
  await mockRecipeSearch(page);
  await mockRecipeCategories(page);

  if (options.withRecipeDetail) {
    await mockRecipeDetail(page);
  }
  if (options.withAiDraft) {
    await mockAiChefStream(page, 'sse-draft-response.txt');
  }
  if (options.withAiSearch) {
    await mockAiChefStream(page, 'sse-search-response.txt');
  }
}
