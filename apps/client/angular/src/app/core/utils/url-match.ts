export function getApiOrigin(apiUrl: string): string | null {
  try {
    return new URL(apiUrl).origin;
  } catch {
    return null;
  }
}

export function isSameOriginAsApi(requestUrl: string, apiOrigin: string | null): boolean {
  if (!apiOrigin) {
    return false;
  }
  try {
    const target = new URL(requestUrl);
    return target.origin === apiOrigin;
  } catch {
    return false;
  }
}
