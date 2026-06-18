import {
  buildContentSecurityPolicy,
  resolveApiOrigin,
  contentSecurityPolicyMiddleware,
  isApiOriginExplicitlySet,
  logStartupWarnings,
} from './csp';

describe('buildContentSecurityPolicy', () => {
  it('includes all required directives', () => {
    const csp = buildContentSecurityPolicy('http://localhost:8000');
    const required = [
      'default-src',
      'script-src',
      'style-src',
      'img-src',
      'connect-src',
      'font-src',
      'object-src',
      'frame-ancestors',
      'base-uri',
      'form-action',
    ];
    for (const directive of required) {
      expect(csp).toContain(directive);
    }
  });

  it("includes 'self' in connect-src", () => {
    const csp = buildContentSecurityPolicy('http://localhost:8000');
    expect(csp).toContain("connect-src 'self'");
  });

  it('includes the API origin in connect-src', () => {
    const csp = buildContentSecurityPolicy('https://api.example.com');
    expect(csp).toContain('https://api.example.com');
  });

  it('includes the Supabase wildcard in connect-src', () => {
    const csp = buildContentSecurityPolicy('http://localhost:8000');
    expect(csp).toContain('https://*.supabase.co');
  });

  it("sets frame-ancestors to 'none' (clickjacking protection)", () => {
    const csp = buildContentSecurityPolicy('http://localhost:8000');
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("sets object-src to 'none'", () => {
    const csp = buildContentSecurityPolicy('http://localhost:8000');
    expect(csp).toContain("object-src 'none'");
  });

  it("sets default-src to 'self'", () => {
    const csp = buildContentSecurityPolicy('http://localhost:8000');
    expect(csp).toContain("default-src 'self'");
  });

  it("allows 'unsafe-inline' in style-src for Angular SSR", () => {
    const csp = buildContentSecurityPolicy('http://localhost:8000');
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
  });

  it('uses the provided API origin, not a hardcoded one', () => {
    const csp = buildContentSecurityPolicy('https://api.staging.example.com');
    expect(csp).toContain('https://api.staging.example.com');
    expect(csp).not.toContain('http://localhost:8000');
  });

  it('produces a valid directive format', () => {
    const csp = buildContentSecurityPolicy('http://localhost:8000');
    const parts = csp.split(';').map((p) => p.trim());
    expect(parts.length).toBeGreaterThan(5);
    for (const part of parts) {
      expect(part).toMatch(/^[a-z-]+ /);
    }
  });
});

describe('resolveApiOrigin', () => {
  const originalEnv = process.env['API_PUBLIC_ORIGIN'];

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env['API_PUBLIC_ORIGIN'];
    } else {
      process.env['API_PUBLIC_ORIGIN'] = originalEnv;
    }
  });

  it('returns API_PUBLIC_ORIGIN when set', () => {
    process.env['API_PUBLIC_ORIGIN'] = 'https://api.example.com';
    expect(resolveApiOrigin()).toBe('https://api.example.com');
  });

  it('returns trimmed value when set with whitespace', () => {
    process.env['API_PUBLIC_ORIGIN'] = '  https://api.example.com  ';
    expect(resolveApiOrigin()).toBe('https://api.example.com');
  });

  it('returns default when env var is not set', () => {
    delete process.env['API_PUBLIC_ORIGIN'];
    expect(resolveApiOrigin()).toBe('http://localhost:8000');
  });

  it('returns default when env var is empty string', () => {
    process.env['API_PUBLIC_ORIGIN'] = '';
    expect(resolveApiOrigin()).toBe('http://localhost:8000');
  });

  it('returns default when env var is whitespace only', () => {
    process.env['API_PUBLIC_ORIGIN'] = '   ';
    expect(resolveApiOrigin()).toBe('http://localhost:8000');
  });
});

describe('isApiOriginExplicitlySet', () => {
  const original = process.env['API_PUBLIC_ORIGIN'];

  afterEach(() => {
    if (original === undefined) {
      delete process.env['API_PUBLIC_ORIGIN'];
    } else {
      process.env['API_PUBLIC_ORIGIN'] = original;
    }
  });

  it('returns false when unset', () => {
    delete process.env['API_PUBLIC_ORIGIN'];
    expect(isApiOriginExplicitlySet()).toBe(false);
  });

  it('returns false when empty', () => {
    process.env['API_PUBLIC_ORIGIN'] = '';
    expect(isApiOriginExplicitlySet()).toBe(false);
  });

  it('returns false when whitespace', () => {
    process.env['API_PUBLIC_ORIGIN'] = '   ';
    expect(isApiOriginExplicitlySet()).toBe(false);
  });

  it('returns true when set', () => {
    process.env['API_PUBLIC_ORIGIN'] = 'https://api.example.com';
    expect(isApiOriginExplicitlySet()).toBe(true);
  });
});

describe('logStartupWarnings', () => {
  const original = process.env['API_PUBLIC_ORIGIN'];
  const originalEnv = process.env['ENV'];

  afterEach(() => {
    if (original === undefined) {
      delete process.env['API_PUBLIC_ORIGIN'];
    } else {
      process.env['API_PUBLIC_ORIGIN'] = original;
    }
    if (originalEnv === undefined) {
      delete process.env['ENV'];
    } else {
      process.env['ENV'] = originalEnv;
    }
  });

  it('emits warning when API_PUBLIC_ORIGIN is not set', () => {
    delete process.env['API_PUBLIC_ORIGIN'];
    delete process.env['ENV'];
    const logger = vi.fn();
    logStartupWarnings(logger);
    expect(logger).toHaveBeenCalledOnce();
    expect(logger.mock.calls[0][0]).toContain('API_PUBLIC_ORIGIN');
    expect(logger.mock.calls[0][0]).toContain('not set');
  });

  it('emits production-specific warning when ENV=production and origin not set', () => {
    delete process.env['API_PUBLIC_ORIGIN'];
    process.env['ENV'] = 'production';
    const logger = vi.fn();
    logStartupWarnings(logger);
    expect(logger).toHaveBeenCalledOnce();
    const message = logger.mock.calls[0][0];
    expect(message).toContain('production');
    expect(message).toContain('blocked');
  });

  it('does not emit warning when API_PUBLIC_ORIGIN is set', () => {
    process.env['API_PUBLIC_ORIGIN'] = 'https://api.example.com';
    delete process.env['ENV'];
    const logger = vi.fn();
    logStartupWarnings(logger);
    expect(logger).not.toHaveBeenCalled();
  });

  it('uses console.warn by default when no logger provided', () => {
    delete process.env['API_PUBLIC_ORIGIN'];
    delete process.env['ENV'];
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      logStartupWarnings();
      expect(warnSpy).toHaveBeenCalledOnce();
    } finally {
      warnSpy.mockRestore();
    }
  });
});

describe('contentSecurityPolicyMiddleware', () => {
  it('sets Content-Security-Policy header on response', () => {
    const middleware = contentSecurityPolicyMiddleware();
    const setHeader = vi.fn();
    const res = { setHeader } as unknown as Parameters<
      ReturnType<typeof contentSecurityPolicyMiddleware>
    >[1];
    const next = vi.fn() as unknown as Parameters<
      ReturnType<typeof contentSecurityPolicyMiddleware>
    >[2];

    middleware({} as Parameters<ReturnType<typeof contentSecurityPolicyMiddleware>>[0], res, next);

    expect(setHeader).toHaveBeenCalledWith(
      'Content-Security-Policy',
      expect.stringContaining("default-src 'self'"),
    );
    expect(next).toHaveBeenCalledOnce();
  });

  it('includes API_PUBLIC_ORIGIN in the header', () => {
    const original = process.env['API_PUBLIC_ORIGIN'];
    process.env['API_PUBLIC_ORIGIN'] = 'https://api.prod.example.com';
    try {
      const middleware = contentSecurityPolicyMiddleware();
      const setHeader = vi.fn();
      const res = { setHeader } as unknown as Parameters<
        ReturnType<typeof contentSecurityPolicyMiddleware>
      >[1];
      const next = vi.fn() as unknown as Parameters<
        ReturnType<typeof contentSecurityPolicyMiddleware>
      >[2];

      middleware(
        {} as Parameters<ReturnType<typeof contentSecurityPolicyMiddleware>>[0],
        res,
        next,
      );

      const cspValue = setHeader.mock.calls[0][1];
      expect(cspValue).toContain('https://api.prod.example.com');
    } finally {
      if (original === undefined) {
        delete process.env['API_PUBLIC_ORIGIN'];
      } else {
        process.env['API_PUBLIC_ORIGIN'] = original;
      }
    }
  });
});
