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
        Authorization: `Bearer ${token}`
      }
    });
    return next(clonedReq);
  }

  return throwError(() => new HttpErrorResponse({
    status: 401,
    statusText: 'Unauthorized',
    url: req.url,
    error: 'Must be authenticated.'
  }));

};
