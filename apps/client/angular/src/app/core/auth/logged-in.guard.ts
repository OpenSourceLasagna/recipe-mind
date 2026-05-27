import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const loggedInGuard: CanMatchFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  console.log('loggedInGuard');
  if (authService.isAuthenticated()) {
    return router.createUrlTree(['/dashboard']);
  }
  return true;
};
