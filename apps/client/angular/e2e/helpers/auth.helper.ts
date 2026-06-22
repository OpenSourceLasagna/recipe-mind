import { Page } from '@playwright/test';

export async function mockAuth(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const fakeSession = {
      access_token: 'e2e-fake-access-token',
      token_type: 'bearer',
      expires_in: 86400,
      expires_at: Date.now() + 86400000,
      refresh_token: 'e2e-fake-refresh-token',
      user: {
        id: 'e2e-test-user',
        email: 'e2e@test.com',
        user_metadata: {},
        app_metadata: {},
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      },
    };

    const key = 'supabase.auth.token';
    window.localStorage.setItem(key, JSON.stringify(fakeSession));
    window.localStorage.setItem(
      `${key}-code-verifier`,
      JSON.stringify(Date.now()),
    );

    const supabaseKey = Object.keys(window.localStorage).find((k) =>
      k.startsWith('sb-'),
    );
    if (!supabaseKey) {
      window.localStorage.setItem(
        'sb-qtwxzkjiyvtmltwoposv-auth-token',
        JSON.stringify(fakeSession),
      );
    }
  });
}

export async function waitForApp(page: Page): Promise<void> {
  await page.waitForSelector('app-root', { state: 'attached', timeout: 15000 });
  await page.waitForTimeout(1000);
}

export async function loginAndNavigate(
  page: Page,
  path: string,
): Promise<void> {
  await mockAuth(page);
  await page.goto(path);
  await waitForApp(page);
}
