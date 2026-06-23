import { signal } from '@angular/core';
import { Difficulty } from '../../models/difficulty.model';
import {
  debounce,
  max,
  maxLength,
  min,
  minLength,
  required,
  SchemaPathTree,
} from '@angular/forms/signals';

export interface RecipeCreationFormModel {
  title: string;
  origin: string;
  servings: number;
  durationMinutes: number;
  difficulty: Difficulty;
  spiceLevel: number;
  isPublic: boolean;
  dietTagsText: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
}

export function createRecipeCreationModel() {
  return signal<RecipeCreationFormModel>({
    title: '',
    origin: 'Unknown',
    servings: 4,
    durationMinutes: 0,
    difficulty: 'medium',
    spiceLevel: 0,
    isPublic: false,
    dietTagsText: '',
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
  });
}

export function buildRecipeCreationSection(schema: SchemaPathTree<RecipeCreationFormModel>) {
  debounce(schema.title, 200);
  debounce(schema.dietTagsText, 200);
  debounce(schema.origin, 200);
  required(schema.title, { message: 'Recipe title is required' });
  minLength(schema.title, 3, { message: 'Title should be at least 3 characters' });
  maxLength(schema.title, 120, { message: 'Title may not exceed 120 characters' });
  maxLength(schema.dietTagsText, 200, { message: 'Diet tags text is too long' });
  maxLength(schema.origin, 60, { message: 'Origin may not exceed 60 characters' });
  min(schema.spiceLevel, 0, { message: 'Spice level must be at least 0' });
  max(schema.spiceLevel, 5, { message: 'Spice level may not exceed 5' });
}
