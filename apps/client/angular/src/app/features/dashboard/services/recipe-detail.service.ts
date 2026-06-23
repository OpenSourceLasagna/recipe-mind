import { computed, inject, Injectable, resource, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { RecipeDetailResponse } from '../models/recipe-detail.model';
import { RecipePatchRequest } from '../models/recipe-edit.model';
import { RecipeResponse } from '../models/recipe.model';
import { getChangedFieldNames } from '../utils/recipe-diff.utils';

@Injectable({ providedIn: 'root' })
export class RecipeDetailService {
  readonly #http = inject(HttpClient);
  readonly #baseUrl = new URL('v1/recipes', environment.apiUrl).toString();

  readonly #recipeId = signal<string>('');
  readonly currentRecipeId = computed(() => this.#recipeId() || null);

  readonly recipe = resource<RecipeDetailResponse | undefined, string>({
    params: () => this.#recipeId(),
    loader: ({ params }) => {
      if (params) {
        return firstValueFrom(this.#http.get<RecipeDetailResponse>(`${this.#baseUrl}/${params}`));
      }
      return new Promise((_) => undefined);
    },
  });

  readonly isEditing = signal(false);

  readonly #aiModifiedRecipe = signal<RecipeResponse | null>(null);
  readonly #aiChangedFields = signal<string[]>([]);
  readonly aiModifiedRecipe = this.#aiModifiedRecipe.asReadonly();

  readonly viewMode = signal<'original' | 'modified'>('original');

  readonly activeRecipe = computed(() => {
    const detail = this.recipe.value();
    if (!detail) return undefined;
    const aiModified = this.#aiModifiedRecipe();
    if (this.viewMode() === 'modified') {
      return aiModified ?? detail.modifiedRecipe ?? detail;
    }
    return detail;
  });

  readonly hasModified = computed(
    () => !!this.recipe.value()?.modifiedRecipe || !!this.#aiModifiedRecipe(),
  );

  readonly isOwner = computed(() => this.recipe.value()?.isOwner ?? false);

  readonly changedFields = computed(() => {
    const aiFields = this.#aiChangedFields();
    const detail = this.recipe.value();
    const changed = new Set<string>(aiFields);

    if (detail?.modifiedRecipe) {
      const apiFields = getChangedFieldNames(detail, detail.modifiedRecipe);
      apiFields.forEach((f) => changed.add(f));
    }

    return changed;
  });

  readonly #saveError = signal<string | null>(null);
  readonly saveError = this.#saveError.asReadonly();

  setRecipeId(id: string): void {
    if (this.#recipeId() === id) {
      this.viewMode.set('original');
      this.isEditing.set(false);
      this.#saveError.set(null);
      return;
    }
    this.#recipeId.set(id);
    this.viewMode.set('original');
    this.isEditing.set(false);
    this.#saveError.set(null);
    if (!id) {
      this.#aiModifiedRecipe.set(null);
      this.#aiChangedFields.set([]);
    }
  }

  setAiModifiedRecipe(recipe: RecipeResponse, changedFields: string[]): void {
    this.#aiModifiedRecipe.set(recipe);
    this.#aiChangedFields.set(changedFields);
    this.viewMode.set('modified');
  }

  clearAiModifiedRecipe(): void {
    this.#aiModifiedRecipe.set(null);
    this.#aiChangedFields.set([]);
    this.viewMode.set('original');
  }

  toggleEdit(): void {
    this.isEditing.update((v) => !v);
    this.#saveError.set(null);
  }

  cancelEdit(): void {
    this.isEditing.set(false);
    this.#saveError.set(null);
  }

  setViewMode(mode: 'original' | 'modified'): void {
    this.viewMode.set(mode);
  }

  async saveEdit(payload: RecipePatchRequest): Promise<void> {
    const id = this.#recipeId();
    if (!id) return;

    try {
      await firstValueFrom(
        this.#http.patch<RecipeDetailResponse>(`${this.#baseUrl}/${id}`, payload),
      );
      this.isEditing.set(false);
      this.#saveError.set(null);
      this.recipe.reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save recipe';
      this.#saveError.set(msg);
      throw err;
    }
  }
}
