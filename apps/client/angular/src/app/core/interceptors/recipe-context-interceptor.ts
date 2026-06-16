import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { RecipeDetailService } from '../../features/dashboard/services/recipe-detail.service';
import { environment } from '../../../environments/environment';

export const recipeContextInterceptor: HttpInterceptorFn = (req, next) => {
  const chatUrl = new URL('v1/ai-chef/chat', environment.apiUrl).toString();
  const isTargetingAiChef = req.url.toLowerCase() == chatUrl.toLowerCase();

  if (!isTargetingAiChef) {
    return next(req);
  }

  const recipeId = inject(RecipeDetailService).currentRecipeId();
  if (!recipeId) return next(req);

  const body = req.body as Record<string, unknown> | null;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return next(req);
  }

  if (body['currentRecipeId']) return next(req);

  return next(req.clone({ body: { ...body, currentRecipeId: recipeId } }));
};

export const createFetchRecipeContextInterceptor = () => {
  const recipeDetailService = inject(RecipeDetailService);

  return (...args: Parameters<typeof fetch>): Parameters<typeof fetch> => {
    let [input, init = {}] = args;
    const chatUrl = new URL('v1/ai-chef/chat', environment.apiUrl).toString();
    const isTargetingAiChef = input.toString().toLowerCase() == chatUrl.toLowerCase();

    if (!isTargetingAiChef) {
      return args;
    }

    const currentRecipeId = recipeDetailService.currentRecipeId();

    if (!currentRecipeId) {
      return args;
    }

    try {
      const body = init.body != null ? JSON.parse(init.body.toString()) : {};
      body.currentRecipeId = currentRecipeId;
      init.body = JSON.stringify(body);
      return [input, init];
    } catch {
      return args;
    }
  };
};
