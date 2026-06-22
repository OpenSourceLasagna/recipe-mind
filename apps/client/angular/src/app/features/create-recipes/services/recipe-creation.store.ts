import { computed, inject, Injectable, signal } from '@angular/core';
import { form } from '@angular/forms/signals';
import { catchError, map, Observable, of, switchMap, tap, throwError } from 'rxjs';
import { CreateRecipeRequest } from '../models/create-recipe.model';
import { RecipeResponse } from '../../dashboard/models/recipe.model';
import { RecipeService } from './recipe.service';
import {
  buildRecipeCreationSection,
  createRecipeCreationModel,
} from '../components/recipe-creation-form/recipe-creation-form.model';
import { IngredientEditRow } from '../../../shared/models/ingredient-edit-row.model';

export type CreationMethod = 'link' | 'text' | 'image' | 'editor';

/**
 * Singleton store that persists the entire recipe creation state across tab switches.
 * All form data, ingredients, and creation mode selection survive navigation.
 */
@Injectable({ providedIn: 'root' })
export class RecipeCreationStore {
  readonly #recipeService = inject(RecipeService);

  readonly activeMethod = signal<CreationMethod>('link');

  readonly urlInput = signal('');

  readonly rawTextInput = signal('');

  // ── Extraction state ──
  readonly isExtracting = signal(false);
  readonly extractionError = signal<string | null>(null);

  // ── Editor (structured) mode state ──
  readonly editorModel = createRecipeCreationModel();
  readonly editorForm = form(this.editorModel, buildRecipeCreationSection);

  readonly editorIngredients = signal<IngredientEditRow[]>([
    { ingredientName: '', quantity: 1, unit: '' },
  ]);
  readonly editorIngredientsTouched = signal(false);

  readonly ingredientsValid = computed(() => {
    const list = this.editorIngredients();
    if (list.length === 0) {
      return { valid: false, message: 'Please add at least one ingredient' };
    }
    const allValid = list.every((row) => row.ingredientName.trim().length > 0 && row.quantity > 0);
    return allValid
      ? { valid: true, message: null }
      : {
          valid: false,
          message: 'All ingredients must have a name and a quantity higher than 0',
        };
  });

  /** True when the editor form and ingredients are both valid. */
  readonly editorReady = computed(() => this.editorForm().valid() && this.ingredientsValid().valid);

  setActiveMethod(method: CreationMethod): void {
    this.activeMethod.set(method);
    this.extractionError.set(null);
  }

  reset(): void {
    this.activeMethod.set('link');
    this.urlInput.set('');
    this.rawTextInput.set('');
    this.isExtracting.set(false);
    this.extractionError.set(null);
    this.editorModel.set({
      title: '',
      origin: 'Unknown',
      servings: 4,
      durationMinutes: 0,
      difficulty: 'medium',
      spiceLevel: 2,
      isPublic: false,
      instructionsText: '',
      additionalInformationText: '',
      dietTagsText: '',
      calories: '',
      protein: '',
      carbs: '',
      fat: '',
    });
    this.editorIngredients.set([{ ingredientName: '', quantity: 1, unit: '' }]);
    this.editorIngredientsTouched.set(false);
  }

  resetEditor(): void {
    this.editorModel.set({
      title: '',
      origin: 'Unknown',
      servings: 4,
      durationMinutes: 0,
      difficulty: 'medium',
      spiceLevel: 2,
      isPublic: false,
      instructionsText: '',
      additionalInformationText: '',
      dietTagsText: '',
      calories: '',
      protein: '',
      carbs: '',
      fat: '',
    });
    this.editorIngredients.set([{ ingredientName: '', quantity: 1, unit: '' }]);
    this.editorIngredientsTouched.set(false);
  }

  /** Build a CreateRecipeRequest from the current editor state. */
  buildRequest(): CreateRecipeRequest {
    const model = this.editorModel();
    const ingredients = this.editorIngredients()
      .filter((row) => row.ingredientName.trim().length > 0)
      .map((row) => ({
        ingredientName: row.ingredientName.trim(),
        quantity: Number(row.quantity) || 1,
        unit: row.unit.trim(),
      }));

    const instructions = model.instructionsText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length);

    const additionalInformation = model.additionalInformationText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length);

    const nutrition: Record<string, number> = {};
    const addNutrition = (key: string, raw: string) => {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) nutrition[key] = parsed;
    };
    addNutrition('calories', model.calories);
    addNutrition('protein', model.protein);
    addNutrition('carbs', model.carbs);
    addNutrition('fat', model.fat);

    return {
      title: model.title.trim(),
      additionalInformation,
      instructionSteps: instructions,
      nutrition,
      servings: model.servings,
      durationMinutes: model.durationMinutes,
      difficulty: model.difficulty,
      spiceLevel: model.spiceLevel,
      origin: model.origin.trim() || 'Unknown',
      isPublic: model.isPublic,
      ingredients,
    };
  }

  /** Call the extraction API and populate the editor form on success. */
  extract(source: 'text' | 'image' | 'url', content: string): Observable<CreateRecipeRequest> {
    this.isExtracting.set(true);
    this.extractionError.set(null);

    return this.#recipeService.extractRecipe(source, content).pipe(
      tap((result) => {
        this.populateFromExtraction(result);
        this.isExtracting.set(false);
        this.activeMethod.set('editor');
      }),
      catchError((err) => {
        this.isExtracting.set(false);
        const message = err?.error?.detail ?? err?.message ?? 'Extraction failed';
        this.extractionError.set(message);
        return throwError(() => err);
      }),
    );
  }

  /** Populate the editor form and ingredients from an extracted CreateRecipeRequest. */
  populateFromExtraction(data: CreateRecipeRequest): void {
    const nutrition = data.nutrition ?? {};
    this.editorModel.set({
      title: data.title ?? '',
      origin: data.origin?.trim() || 'Unknown',
      servings: data.servings || 4,
      durationMinutes: data.durationMinutes || 0,
      difficulty: (data.difficulty as 'easy' | 'medium' | 'hard') ?? 'medium',
      spiceLevel: data.spiceLevel ?? 2,
      isPublic: data.isPublic ?? false,
      instructionsText: (data.instructionSteps ?? []).join('\n'),
      additionalInformationText: (data.additionalInformation ?? []).join('\n'),
      dietTagsText: '',
      calories: nutrition['calories'] != null ? String(nutrition['calories']) : '',
      protein: nutrition['protein'] != null ? String(nutrition['protein']) : '',
      carbs: nutrition['carbs'] != null ? String(nutrition['carbs']) : '',
      fat: nutrition['fat'] != null ? String(nutrition['fat']) : '',
    });

    const ingredients = (data.ingredients ?? []).map((ing) => ({
      ingredientName: ing.ingredientName ?? '',
      quantity: ing.quantity ?? 1,
      unit: ing.unit ?? '',
    }));
    this.editorIngredients.set(
      ingredients.length > 0 ? ingredients : [{ ingredientName: '', quantity: 1, unit: '' }],
    );
    this.editorIngredientsTouched.set(true);
  }

  /** Submit the current creation mode and return the observable. */
  submitCurrentMode(): Observable<RecipeResponse | unknown> {
    switch (this.activeMethod()) {
      case 'editor':
        return this.#recipeService.addStructuredRecipe(this.buildRequest());
      case 'link':
        return this.extract('url', this.urlInput());
      case 'text':
        return this.extract('text', this.rawTextInput());
      case 'image':
        throw new Error('Image upload is not yet implemented');
    }
  }
}
