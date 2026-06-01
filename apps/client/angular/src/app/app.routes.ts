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
        redirectTo: 'explore',
        pathMatch: 'full',
      },
      {
        path: 'explore',
        loadComponent: () =>
          import('./features/dashboard/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent
          ),
      },
      {
        path: 'ai-chef',
        loadComponent: () =>
          import('./features/dashboard/placeholder/placeholder.component').then(
            (m) => m.PlaceholderComponent
          ),
        data: { title: 'AI Chef', description: 'Let AI help you create the perfect recipe.' },
      },
      {
        path: 'add-new',
        loadComponent: () =>
          import('./features/recipes/recipe-creation/recipe-creation.component').then(
            (m) => m.RecipeCreationComponent
          ),
      },
      {
        path: 'saved',
        loadComponent: () =>
          import('./features/dashboard/placeholder/placeholder.component').then(
            (m) => m.PlaceholderComponent
          ),
        data: { title: 'Saved Recipes', description: 'Your collection of saved recipes will appear here.' },
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/dashboard/placeholder/placeholder.component').then(
            (m) => m.PlaceholderComponent
          ),
        data: { title: 'Profile', description: 'Your profile information.' },
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/dashboard/placeholder/placeholder.component').then(
            (m) => m.PlaceholderComponent
          ),
        data: { title: 'Settings', description: 'Application settings.' },
      },
    ],
  },
  { path: '**', redirectTo: 'auth/login' }
];
