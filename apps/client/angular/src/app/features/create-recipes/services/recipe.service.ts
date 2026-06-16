import { inject, Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
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

  addUrlRecipe(url: string | URL): Observable<unknown> {
    let validUrlString: string;
    try {
      validUrlString = new URL(url).toString();
    } catch (error) {
      return throwError(() => new Error('Invalid URL provided'));
    }
    return this.#http.post(`${this.#baseUrl}/url`, { url: validUrlString });
  }

  addTextRecipe(text: string): Observable<unknown> {
    return this.#http.post(`${this.#baseUrl}/text`, { text });
  }
}
