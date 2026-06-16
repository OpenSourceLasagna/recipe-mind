import { RecipeResponse } from './recipe.model';

/**
 * Full recipe detail from the API.
 * Extends the base recipe response with ownership and a possible AI-modified variant.
 */
export interface RecipeDetailResponse extends RecipeResponse {
  /** Whether the current authenticated user owns this recipe. */
  isOwner: boolean;

  /** An optional AI-modified version of the same recipe (same shape as RecipeResponse). */
  modifiedRecipe: RecipeResponse | null;
}
