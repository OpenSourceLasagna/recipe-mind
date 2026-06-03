import { Difficulty } from "./difficulty.model";

export interface CreateIngredientRequest {
  ingredientName: string;
  quantity: number;
  unit: string;
}

export interface CreateRecipeRequest {
  title: string;
  ingredients: CreateIngredientRequest[];
  additionalInformation: string[];
  instructionSteps: string[];
  nutrition: Record<string, any>;
  servings: number;
  durationMinutes: number;
  difficulty: Difficulty;
  spiceLevel: number;
  origin: string;
  isPublic: boolean;
}
