import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, ResolveFn } from '@angular/router';
import { RecipeListService } from '../services/recipe-list.service';
import { RecipeFilterService } from '../services/recipe-filter.service';

export const recipeListResolver: ResolveFn<boolean> = (route: ActivatedRouteSnapshot) => {
  const filterService = inject(RecipeFilterService);
  const listService = inject(RecipeListService);
  filterService.hydrateFromParams(route.queryParams);
  listService.preload();
  return true;
};
