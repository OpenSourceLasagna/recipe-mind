import { Difficulty } from '../../create-recipes/models/difficulty.model';

/**
 * Form model used when editing a recipe inline in the detail view.
 */
export interface RecipeEditForm {
  title: string;
  servings: number;
  durationMinutes: number;
  difficulty: Difficulty;
  spiceLevel: number;
  origin: string;
  isPublic: boolean;
  additionalInformation: string[];
  instructionSteps: string[];
  ingredients: {
    ingredientName: string;
    quantity: number;
    unit: string;
  }[];
}

/**
 * Payload sent to PATCH /v1/recipes/:id.
 * Every field is optional; only present fields are updated.
 */
export interface RecipePatchRequest {
  title?: string;
  servings?: number;
  durationMinutes?: number;
  difficulty?: Difficulty;
  spiceLevel?: number;
  origin?: string;
  isPublic?: boolean;
  additionalInformation?: string[];
  instructionSteps?: string[];
  ingredients?: {
    ingredientName: string;
    quantity: number;
    unit: string;
  }[];
}
