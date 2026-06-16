import { computed, inject, Injectable, resource, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { RecipeDetailResponse } from '../models/recipe-detail.model';
import { RecipePatchRequest } from '../models/recipe-edit.model';

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

  readonly viewMode = signal<'original' | 'modified'>('original');

  readonly activeRecipe = computed(() => {
    const detail = this.recipe.value();
    if (!detail) return undefined;
    return this.viewMode() === 'modified' && detail.modifiedRecipe ? detail.modifiedRecipe : detail;
  });

  readonly hasModified = computed(() => !!this.recipe.value()?.modifiedRecipe);

  readonly isOwner = computed(() => this.recipe.value()?.isOwner ?? false);

  readonly changedFields = computed(() => {
    const detail = this.recipe.value();
    if (!detail?.modifiedRecipe) return new Set<string>();

    const orig = detail;
    const mod = detail.modifiedRecipe;
    const changed = new Set<string>();

    if (orig.title !== mod.title) changed.add('title');
    if (orig.servings !== mod.servings) changed.add('servings');
    if (orig.durationMinutes !== mod.durationMinutes) changed.add('durationMinutes');
    if (orig.difficulty !== mod.difficulty) changed.add('difficulty');
    if (orig.spiceLevel !== mod.spiceLevel) changed.add('spiceLevel');
    if (orig.origin !== mod.origin) changed.add('origin');
    if (orig.isPublic !== mod.isPublic) changed.add('isPublic');

    if (JSON.stringify(orig.additionalInformation) !== JSON.stringify(mod.additionalInformation)) {
      changed.add('additionalInformation');
    }
    if (JSON.stringify(orig.ingredients) !== JSON.stringify(mod.ingredients)) {
      changed.add('ingredients');
    }
    if (JSON.stringify(orig.instructionSteps) !== JSON.stringify(mod.instructionSteps)) {
      changed.add('instructionSteps');
    }
    if (JSON.stringify(orig.nutrition) !== JSON.stringify(mod.nutrition)) {
      changed.add('nutrition');
    }

    return changed;
  });

  readonly #saveError = signal<string | null>(null);
  readonly saveError = this.#saveError.asReadonly();

  setRecipeId(id: string): void {
    if (this.#recipeId() === id) return;
    this.#recipeId.set(id);
    this.isEditing.set(false);
    this.viewMode.set('original');
    this.#saveError.set(null);
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
