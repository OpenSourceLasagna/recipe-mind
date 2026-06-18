import { inject, Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CreateRecipeRequest } from '../models/create-recipe.model';
import { RecipeResponse } from '../../dashboard/models/recipe.model';

@Injectable({
  providedIn: 'root',
})
export class RecipeService {
  readonly #http = inject(HttpClient);
  readonly #baseUrl: string;

  constructor() {
    const apiSuffix = 'v1/recipes';
    this.#baseUrl = new URL(apiSuffix, environment.apiUrl).toString();
  }

  addStructuredRecipe(recipe: CreateRecipeRequest): Observable<RecipeResponse> {
    return this.#http.post<RecipeResponse>(`${this.#baseUrl}/structured`, recipe);
  }

  extractRecipe(
    source: 'text' | 'image' | 'url',
    content: string,
  ): Observable<CreateRecipeRequest> {
    return this.#http.post<CreateRecipeRequest>(`${this.#baseUrl}/extract`, {
      source,
      content,
    });
  }
}
