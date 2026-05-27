import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router); 7
  const authService = inject(AuthService);
  if (authService.isAuthenticated()) {
    return true;
  }
  return router.createUrlTree(['/auth/login']);
};
