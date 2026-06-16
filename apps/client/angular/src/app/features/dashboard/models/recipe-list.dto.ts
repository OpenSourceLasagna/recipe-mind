import { RecipeCardDto } from './recipe-card.dto';

export interface RecipeListDto {
  items: RecipeCardDto[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
