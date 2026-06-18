import { computed, effect, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Params } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { form, max, min } from '@angular/forms/signals';
import { Difficulty } from '../../create-recipes/models/difficulty.model';
import {
  DURATION_RANGE,
  SERVINGS_RANGE,
  type SortByField,
  type SortValue,
  DEFAULT_SORT,
  DEFAULT_FILTER_MODEL,
  type FilterModel,
} from '../models/recipe-filter.model';

@Injectable({ providedIn: 'root' })
export class RecipeFilterService {
  readonly #platformId = inject(PLATFORM_ID);

  readonly isDesktop = signal(this.#resolveIsDesktop());

  readonly isMobile = computed(() => !this.isDesktop());

  #resolveIsDesktop(): boolean {
    if (!isPlatformBrowser(this.#platformId)) return true;
    try {
      return window.matchMedia?.('(min-width: 1024px)').matches ?? true;
    } catch {
      return true;
    }
  }

  readonly model = signal<FilterModel>({ ...DEFAULT_FILTER_MODEL });

  readonly form = form(this.model, (f) => {
    min(f.spiceMax, 1);
    max(f.spiceMax, 5);
  });

  readonly #c = {
    difficulty: signal<Difficulty | null>(null),
    spiceMax: signal<number | null>(null),
    duration: signal<[number, number]>([...DURATION_RANGE]),
    servings: signal<[number, number]>([...SERVINGS_RANGE]),
    origin: signal<string | null>(null),
    categories: signal<string | null>(null),
    sortBy: signal(DEFAULT_SORT.sortBy),
    sortOrder: signal(DEFAULT_SORT.sortOrder),
  };

  readonly #query = signal<string | null>(null);
  readonly query = this.#query.asReadonly();

  readonly #page = signal(1);
  readonly pageSize = signal(20);

  readonly sortValue = computed<SortValue>(() => ({
    sortBy: this.model().sortBy,
    sortOrder: this.model().sortOrder,
  }));

  readonly activeFilters = computed(() => {
    const m = this.model();
    const names: string[] = [];
    if (m.difficulty) names.push('difficulty');
    if (m.spiceMax) names.push('spice');
    if (m.duration[0] > DURATION_RANGE[0] || m.duration[1] < DURATION_RANGE[1])
      names.push('duration');
    if (m.servings[0] > SERVINGS_RANGE[0] || m.servings[1] < SERVINGS_RANGE[1])
      names.push('servings');
    if (m.origin) names.push('origin');
    if (m.categories) names.push('categories');
    return names;
  });

  readonly toHttpParams = computed(() => {
    let params = new HttpParams();
    const c = this.#c;
    params = append(params, 'query', this.#query());
    params = append(params, 'difficulty', c.difficulty());
    params = append(params, 'spiceLevelMax', c.spiceMax());
    const [durMin, durMax] = c.duration();
    if (durMin > DURATION_RANGE[0]) params = params.set('durationMin', String(durMin));
    if (durMax < DURATION_RANGE[1]) params = params.set('durationMax', String(durMax));
    const [srvMin, srvMax] = c.servings();
    if (srvMin > SERVINGS_RANGE[0]) params = params.set('servingsMin', String(srvMin));
    if (srvMax < SERVINGS_RANGE[1]) params = params.set('servingsMax', String(srvMax));
    params = append(params, 'origin', c.origin());
    params = append(params, 'ingredientCategories', c.categories());
    params = params.set('sortBy', c.sortBy());
    params = params.set('sortOrder', c.sortOrder());
    params = params.set('page', String(this.#page()));
    params = params.set('pageSize', String(this.pageSize()));
    return params;
  });

  constructor() {
    effect((onCleanup) => {
      if (!this.isDesktop()) return;
      this.model();
      const timer = setTimeout(() => this.commit(), 1000);
      onCleanup(() => clearTimeout(timer));
    });
  }

  setQuery(value: string | null): void {
    this.#query.set(value);
    if (value) {
      this.model.update((m) => ({ ...m, sortBy: 'relevance' }));
      this.#c.sortBy.set('relevance');
    } else {
      this.model.update((m) => ({ ...m, sortBy: DEFAULT_SORT.sortBy }));
      this.#c.sortBy.set(DEFAULT_SORT.sortBy);
    }
    this.#page.set(1);
  }

  hydrateFromParams(params: Params): void {
    const m: FilterModel = { ...DEFAULT_FILTER_MODEL };
    const hasQuery = !!params['query'];
    this.#query.set((params['query'] as string) ?? null);

    if (hasQuery && !params['sortBy']) {
      m.sortBy = 'relevance';
    }

    if (params['difficulty']) m.difficulty = params['difficulty'] as Difficulty;
    if (params['spiceLevelMax']) m.spiceMax = Number(params['spiceLevelMax']);
    if (params['durationMin'] || params['durationMax']) {
      m.duration = [
        params['durationMin'] ? Number(params['durationMin']) : DURATION_RANGE[0],
        params['durationMax'] ? Number(params['durationMax']) : DURATION_RANGE[1],
      ];
    }
    if (params['servingsMin'] || params['servingsMax']) {
      m.servings = [
        params['servingsMin'] ? Number(params['servingsMin']) : SERVINGS_RANGE[0],
        params['servingsMax'] ? Number(params['servingsMax']) : SERVINGS_RANGE[1],
      ];
    }
    if (params['origin']) m.origin = params['origin'] as string;
    if (params['ingredientCategories']) m.categories = params['ingredientCategories'] as string;
    if (params['sortBy']) m.sortBy = params['sortBy'] as SortByField;
    if (params['sortOrder']) m.sortOrder = params['sortOrder'] as 'asc' | 'desc';

    this.model.set(m);
    this.commit();

    if (params['page']) this.#page.set(Number(params['page']));
  }

  commit(): void {
    const m = this.model();
    this.#c.difficulty.set(m.difficulty);
    this.#c.spiceMax.set(m.spiceMax);
    this.#c.duration.set([...m.duration]);
    this.#c.servings.set([...m.servings]);
    this.#c.origin.set(m.origin);
    this.#c.categories.set(m.categories);
    this.#c.sortBy.set(m.sortBy);
    this.#c.sortOrder.set(m.sortOrder);
    this.#page.set(1);
  }

  resetAll(): void {
    this.model.set({ ...DEFAULT_FILTER_MODEL });
    this.commit();
  }

  setSortValue(v: SortValue): void {
    this.form.sortBy().value.set(v.sortBy);
    this.form.sortOrder().value.set(v.sortOrder);
  }

  toggleDifficulty(value: Difficulty): void {
    this.form.difficulty().value.update((c) => (c === value ? null : value));
  }
}

function append(params: HttpParams, key: string, value: unknown): HttpParams {
  if (value === null || value === undefined || value === '') return params;
  return params.set(key, String(value));
}
