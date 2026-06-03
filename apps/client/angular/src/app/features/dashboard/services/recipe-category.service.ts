import { inject, Injectable } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { CategoryItem } from '../models/category.model';

@Injectable({ providedIn: 'root' })
export class RecipeCategoryService {
  readonly #baseUrl = new URL('v1/search/categories', environment.apiUrl).toString();

  readonly categories = httpResource<CategoryItem[]>(() => this.#baseUrl);
}
