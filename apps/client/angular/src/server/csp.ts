import type { RequestHandler } from 'express';

const DEFAULT_API_ORIGIN = 'http://localhost:8000';
const SUPABASE_ORIGIN_PATTERN = 'https://*.supabase.co';

export function buildContentSecurityPolicy(apiOrigin: string): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'"],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:'],
    'connect-src': ["'self'", apiOrigin, SUPABASE_ORIGIN_PATTERN],
    'font-src': ["'self'", 'data:'],
    'object-src': ["'none'"],
    'frame-ancestors': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
  };
  return Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(' ')}`)
    .join('; ');
}

function readRawApiOrigin(): string {
  const fromEnv = process.env['API_PUBLIC_ORIGIN'];
  return fromEnv && fromEnv.trim() ? fromEnv.trim() : '';
}

export function resolveApiOrigin(): string {
  return readRawApiOrigin() || DEFAULT_API_ORIGIN;
}

export function isApiOriginExplicitlySet(): boolean {
  return readRawApiOrigin() !== '';
}

export function logStartupWarnings(logger: (msg: string) => void = console.warn): void {
  if (isApiOriginExplicitlySet()) {
    return;
  }
  const env = process.env['ENV'];
  const isProduction = env === 'production';

  if (isProduction) {
    logger(
      '[SECURITY] API_PUBLIC_ORIGIN is not set in production. ' +
        'Falling back to http://localhost:8000 for CSP connect-src. ' +
        'API calls from the browser will be blocked. ' +
        'Set API_PUBLIC_ORIGIN to your production API URL.',
    );
  } else {
    logger(
      '[SECURITY] API_PUBLIC_ORIGIN is not set. Using default ' +
        'http://localhost:8000. Set it in your environment for non-localhost deployments.',
    );
  }
}

export function contentSecurityPolicyMiddleware(): RequestHandler {
  return (_req, res, next) => {
    res.setHeader('Content-Security-Policy', buildContentSecurityPolicy(resolveApiOrigin()));
    next();
  };
}
