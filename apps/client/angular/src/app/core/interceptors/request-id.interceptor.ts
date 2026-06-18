import { HttpInterceptorFn } from '@angular/common/http';

function generateRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'req-' + Math.random().toString(36).slice(2) + '-' + Date.now().toString(36);
}

export const REQUEST_ID_HEADER = 'X-Request-Id';

export const requestIdInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.headers.has(REQUEST_ID_HEADER)) {
    return next(req);
  }
  const cloned = req.clone({
    setHeaders: { [REQUEST_ID_HEADER]: generateRequestId() },
  });
  return next(cloned);
};
