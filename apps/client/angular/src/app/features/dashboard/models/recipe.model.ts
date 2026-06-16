import { Difficulty } from '../../create-recipes/models/difficulty.model';
import { Ingredient, RecipeIngredientResponse } from './ingredient.model';

export interface RecipeResponse {
  id: string;
  title: string;
  additionalInformation: string[];
  instructionSteps: string[];
  nutrition: Record<string, any>;

  servings: number;
  durationMinutes: number;
  difficulty: Difficulty;
  spiceLevel: number;
  origin: string;
  isPublic: boolean;

  ingredients: RecipeIngredientResponse[];

  createdAt: string;
  updatedAt: string;
}

export interface Recipe extends Omit<RecipeResponse, 'ingredients' | 'createdAt' | 'updatedAt'> {
  ingredients: Ingredient[];

  created_at: Date;
  updated_at: Date;
}
