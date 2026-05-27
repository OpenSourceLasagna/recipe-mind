import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
{
    path: 'auth/login',
    renderMode: RenderMode.Prerender
  },
  {
    path: 'auth/registration',
    renderMode: RenderMode.Prerender
  },
  {
    path: 'dashboard/**',
    renderMode: RenderMode.Client
  },
  {
    path: '**',
    renderMode: RenderMode.Server
  }
];
