import { Difficulty } from '../../create-recipes/models/difficulty.model';
import { RecipeResponse } from './recipe.model';

export interface RecipeCardDto {
  id: string;
  title: string;
  difficulty: Difficulty;
  spice_level: number;
  durationMinutes: number;
  servings: number;
}

export function toRecipeCardDto(recipe: RecipeResponse): RecipeCardDto {
  return {
    id: recipe.id,
    title: recipe.title,
    difficulty: recipe.difficulty,
    spice_level: recipe.spiceLevel,
    durationMinutes: recipe.durationMinutes,
    servings: recipe.servings,
  };
}
