import { ChangeDetectionStrategy, Component, output, signal, computed } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmTextareaImports } from '@spartan-ng/helm/textarea';
import { debounce, form, FormField, max, maxLength, min, minLength, required, validate, ValidationError } from '@angular/forms/signals';
import { ReactiveFormsModule } from '@angular/forms';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { HlmCheckboxImports } from '@spartan-ng/helm/checkbox';
import { CreateIngredientsComponent } from "../create-ingredients/create-ingredients.component";
import { IngredientRow } from '../../models/ingredient-row';

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

export interface RecipeCreationPayload {
  title: string;
  additional_information: string[];
  instruction_steps: string[];
  nutrition: Record<string, number>;
  servings: number;
  duration_minutes: number;
  difficulty: Difficulty;
  spice_level: number;
  origin: string;
  is_public: boolean;
  ingredients: IngredientRow[];
  dietTags: string[];
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
  readonly #INITIAL_MODEL: RecipeCreationFormModel = {
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
  };

  readonly DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'] as const;
  ingredients = signal<IngredientRow[]>([{ ingredientName: '', quantity: 1, unit: '' }]);
  ingredientsTouched = signal<boolean>(false);
  readonly submit = output<RecipeCreationPayload>();

  recipeForm = form(
    signal<RecipeCreationFormModel>({ ...this.#INITIAL_MODEL }),
    (schema) => {
      debounce(schema.title, 200);
      debounce(schema.instructionsText, 200);
      debounce(schema.additionalInformationText, 200);
      debounce(schema.dietTagsText, 200);
      debounce(schema.origin, 200);
      required(schema.title, { message: 'Recipe title is required' });
      minLength(schema.title, 3, { message: 'Title should be at least 3 characters' });
      maxLength(schema.title, 120, { message: 'Title may not exceed 120 characters' });
      required(schema.instructionsText, { message: 'Add at least one instruction step' });
      maxLength(schema.instructionsText, 2000, { message: 'Instructions are too long' });
      maxLength(schema.additionalInformationText, 600, { message: 'Additional information is too long' });
      maxLength(schema.dietTagsText, 200, { message: 'Diet tags text is too long' });
      maxLength(schema.origin, 60, { message: 'Origin may not exceed 60 characters' });
      min(schema.spiceLevel, 1, { message: 'Spice level must be at least 1' });
      max(schema.spiceLevel, 5, { message: 'Spice level may not exceed 5' });
    }
  );

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

  public onSubmit(event: Event): void {
    event.preventDefault();

    if (!this.recipeForm().valid() || !this.ingredientsValid().valid) {
      return;
    }

    const instructions = this.splitLines(this.recipeForm.instructionsText().value());
    const additional_information = this.splitLines(this.recipeForm.additionalInformationText().value());
    const dietTags = this.buildDietTags();
    const ingredients = this.ingredients()
      .filter((row) => row.ingredientName.trim().length > 0)
      .map((row) => ({
        ingredientName: row.ingredientName.trim(),
        quantity: Number(row.quantity) || 1,
        unit: row.unit.trim(),
      }));
    this.submit.emit({
      title: this.recipeForm.title().value().trim(),
      additional_information,
      instruction_steps: instructions,
      nutrition: this.buildNutrition(),
      servings: this.recipeForm.servings().value(),
      duration_minutes: this.recipeForm.durationMinutes().value(),
      difficulty: this.recipeForm.difficulty().value(),
      spice_level: this.recipeForm.spiceLevel().value(),
      origin: this.recipeForm.origin().value().trim() || 'Unknown',
      is_public: this.recipeForm.isPublic().value(),
      ingredients,
      dietTags,
    });
  }
}
