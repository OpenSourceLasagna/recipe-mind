import { ChangeDetectionStrategy, Component, output, signal, computed, effect } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmTextareaImports } from '@spartan-ng/helm/textarea';
import { debounce, form, FormField, max, maxLength, min, minLength, required, validate, ValidationError } from '@angular/forms/signals';
import { ReactiveFormsModule } from '@angular/forms';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { HlmCheckboxImports } from '@spartan-ng/helm/checkbox';
import { CreateIngredientsComponent } from "../create-ingredients/create-ingredients.component";
import { IngredientRow } from '../../models/ingredient-row.model';
import { buildRecipeCreationSection, createRecipeCreationModel } from './recipe-creation-form.model';
import { CreateIngredientRequest, CreateRecipeRequest } from '../../models/create-recipe.model';

type Difficulty = 'easy' | 'medium' | 'hard';

interface RecipeCreationFormModel {
  title: string;
  origin: string;
  servings: number;
  durationMinutes: number;
  difficulty: Difficulty;
  spiceLevel: number;
  isPublic: boolean;
  instructionsText: string;
  additionalInformationText: string;
  dietTagsText: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
}


@Component({
  selector: 'app-recipe-creation-form',
  standalone: true,
  imports: [ReactiveFormsModule, HlmLabelImports, HlmCheckboxImports, FormField, HlmButtonImports, HlmFieldImports, HlmInputImports, HlmTextareaImports, CreateIngredientsComponent],
  templateUrl: './recipe-creation-form.component.html',
  styleUrls: ['./recipe-creation-form.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeCreationFormComponent {
  readonly DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'] as const;
  ingredients = signal<CreateIngredientRequest[]>([{ ingredientName: '', quantity: 1, unit: '' }]);
  ingredientsTouched = signal<boolean>(false);
  readonly recipeSubmit = output<CreateRecipeRequest>();

  recipeForm = form(createRecipeCreationModel(), buildRecipeCreationSection);

  readonly ingredientsValid = computed(() => {
    if (this.ingredients().length <= 1) {
      return { valid: false, message: 'Please add at least one ingredient with a name and a quantity higher than 0' };
    }
    const isValid = this.ingredients().every((row, index) =>
      index === 0 ?
        true :
        row.ingredientName.trim().length > 0 && row.quantity > 0
    )
    return isValid ? { valid: true, message: null } : { valid: false, message: 'All ingredients must have a name and a quantity higher than 0' }
  }
  );

  private splitLines(value: string): string[] {
    return value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length);
  }

  private parseNumber(value: string): number | undefined {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private buildNutrition(): Record<string, number> {
    const nutrition: Record<string, number> = {};
    const calories = this.parseNumber(this.recipeForm.calories().value());
    const protein = this.parseNumber(this.recipeForm.protein().value());
    const carbs = this.parseNumber(this.recipeForm.carbs().value());
    const fat = this.parseNumber(this.recipeForm.fat().value());

    if (calories != null) nutrition['calories'] = calories;
    if (protein != null) nutrition['protein'] = protein;
    if (carbs != null) nutrition['carbs'] = carbs;
    if (fat != null) nutrition['fat'] = fat;

    return nutrition;
  }

  private buildDietTags(): string[] {
    const text = this.recipeForm.dietTagsText().value();
    if (!text) return [];
    return text
      .split(/[\n,;]+/)
      .map((tag) => tag.trim())
      .filter((tag) => tag.length);
  }

  public submit(event: Event): void {
    event.preventDefault();

    if (!this.recipeForm().valid() || !this.ingredientsValid().valid) {
      return;
    }

    const instructions = this.splitLines(this.recipeForm.instructionsText().value());
    const additionalInformation = this.splitLines(this.recipeForm.additionalInformationText().value());
    const dietTags = this.buildDietTags();
    const ingredients = this.ingredients()
      .filter((row) => row.ingredientName.trim().length > 0)
      .map((row) => ({
        ingredientName: row.ingredientName.trim(),
        quantity: Number(row.quantity) || 1,
        unit: row.unit.trim(),
      }));
    this.recipeSubmit.emit({
      title: this.recipeForm.title().value().trim(),
      additionalInformation,
      instructionSteps: instructions,
      nutrition: this.buildNutrition(),
      servings: this.recipeForm.servings().value(),
      durationMinutes: this.recipeForm.durationMinutes().value(),
      difficulty: this.recipeForm.difficulty().value(),
      spiceLevel: this.recipeForm.spiceLevel().value(),
      origin: this.recipeForm.origin().value().trim() || 'Unknown',
      isPublic: this.recipeForm.isPublic().value(),
      ingredients,
      //TODO dietTags,
    });
  }
}
