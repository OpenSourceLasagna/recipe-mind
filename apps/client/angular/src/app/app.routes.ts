import { Routes } from '@angular/router';
import { AuthLayoutComponent } from './core/layout/auth-layout/auth-layout.component';
import { WorkspaceLayoutComponent } from './core/layout/workspace-layout/workspace-layout.component';
import { authGuard } from './core/auth/auth.guard';
import { loggedInGuard } from './core/auth/logged-in.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'auth/login', pathMatch: 'full' },
  {
    path: 'auth',
    component: AuthLayoutComponent,
    canMatch: [loggedInGuard],
    children: [
      {
        path: 'login',
        loadComponent: () =>
          import('./features/auth/login/login.component').then(
            (m) => m.LoginComponent
          ),
        data: { mode: 'login' }
      },
      {
        path: 'registration',
        loadComponent: () =>
          import('./features/auth/login/login.component').then(
            (m) => m.LoginComponent
          ),
        data: { mode: 'registration' }
      }
    ]
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    component: WorkspaceLayoutComponent,
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/dashboard/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent
          )
      }
    ]
  },
  { path: '**', redirectTo: 'auth/login' }
];
