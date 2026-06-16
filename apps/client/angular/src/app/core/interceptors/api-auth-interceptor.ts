import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { AuthService } from '../auth/auth.service';
import { inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { throwError } from 'rxjs';

export const apiAuthInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const isTargetingApiUrl = req.url.startsWith(environment.apiUrl);

  if (!isTargetingApiUrl) {
    return next(req);
  }

  const token = authService.accessToken();
  if (token) {
    const clonedReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
    return next(clonedReq);
  }

  return throwError(
    () =>
      new HttpErrorResponse({
        status: 401,
        statusText: 'Unauthorized',
        url: req.url,
        error: 'Must be authenticated.',
      }),
  );
};

export const createFetchAuthInterceptor = () => {
  const authService = inject(AuthService);

  return (...args: Parameters<typeof fetch>): Parameters<typeof fetch> => {
    let [input, init = {}] = args;
    const isTargetingApiUrl = input.toString().startsWith(environment.apiUrl);

    if (!isTargetingApiUrl) {
      return args;
    }

    const token = authService.accessToken();
    if (token) {
      const headers = new Headers(init.headers);
      headers.set('Authorization', `Bearer ${token}`);
      init.headers = headers;
      return [input, init];
    }

    throw TypeError(`Unauthorized. Must be authenticated`);
  };
};
