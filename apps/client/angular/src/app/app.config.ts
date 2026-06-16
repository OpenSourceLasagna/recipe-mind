import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideMarkdown } from 'ngx-markdown';

import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { apiAuthInterceptor } from './core/interceptors/api-auth-interceptor';
import { recipeContextInterceptor } from './core/interceptors/recipe-context-interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideClientHydration(withEventReplay()),
    provideHttpClient(
      withInterceptors([apiAuthInterceptor, recipeContextInterceptor]),
      withFetch(),
    ),
    provideMarkdown(),
  ],
};
