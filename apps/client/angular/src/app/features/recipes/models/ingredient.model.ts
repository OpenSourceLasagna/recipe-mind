export interface RecipeIngredientResponse {
  id: string;
  ingredientName: string;
  quantity: number;
  unit: string;
  categoryId: string | null;
}

export interface Ingredient extends RecipeIngredientResponse {}
