import { inject, Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class RecipeService {
  readonly #http = inject(HttpClient);
  readonly #baseUrl: string;

  constructor() {
    const apiSuffix = '/recipes';
    this.#baseUrl = new URL(apiSuffix, environment.apiUrl).toString();
  }

  getRecipe() {
    this.#http.get(`${this.#baseUrl}/1`).pipe(first()).subscribe(console.log)
  }
}
