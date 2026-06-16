import { inject, Injectable, resource } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { RecipeListDto } from '../models/recipe-list.dto';
import { RecipeFilterService } from './recipe-filter.service';

@Injectable({
  providedIn: 'root',
})
export class RecipeListService {
  readonly #http = inject(HttpClient);
  readonly #filterService = inject(RecipeFilterService);
  readonly #baseUrl = new URL('v1/search', environment.apiUrl).toString();

  readonly recipes = resource<RecipeListDto, HttpParams>({
    params: () => this.#filterService.toHttpParams(),
    loader: ({ params }) =>
      firstValueFrom(this.#http.get<RecipeListDto>(this.#baseUrl, { params })),
  });

  preload(): void {
    if (!this.recipes.hasValue()) {
      this.recipes.reload();
    }
  }
}
