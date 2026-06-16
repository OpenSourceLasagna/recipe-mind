import { Difficulty } from '../../create-recipes/models/difficulty.model';

export interface RecipeCardDto {
  id: string;
  title: string;
  difficulty: Difficulty;
  spice_level: number;
  durationMinutes: number;
  servings: number;
}
