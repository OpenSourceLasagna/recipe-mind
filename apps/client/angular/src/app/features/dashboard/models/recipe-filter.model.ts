import { Difficulty } from '../../create-recipes/models/difficulty.model';

export type SortByField =
  | 'relevance'
  | 'created_at'
  | 'is_public'
  | 'duration_minutes'
  | 'title'
  | 'spice_level'
  | 'difficulty';

export type SortOrder = 'asc' | 'desc';

export type RangeTuple = [number, number];

export interface SortValue {
  sortBy: SortByField;
  sortOrder: SortOrder;
}

export const DEFAULT_SORT: SortValue = { sortBy: 'created_at', sortOrder: 'desc' };

export const DURATION_RANGE: RangeTuple = [0, 300];
export const SERVINGS_RANGE: RangeTuple = [1, 20];

export interface RecipeFilter {
  query: string | null;
  difficulty: Difficulty | null;
  spiceLevelMin: number | null;
  spiceLevelMax: number | null;
  durationMin: number | null;
  durationMax: number | null;
  servingsMin: number | null;
  servingsMax: number | null;
  origin: string | null;
  ingredientCategories: string | null;
  sortBy: SortByField;
  sortOrder: SortOrder;
  page: number;
  pageSize: number;
}

export interface FilterModel {
  difficulty: Difficulty | null;
  spiceMax: number | null;
  duration: RangeTuple;
  servings: RangeTuple;
  origin: string | null;
  categories: string | null;
  sortBy: SortByField;
  sortOrder: SortOrder;
}

export const SORT_BY_LABELS: Record<SortByField, string> = {
  relevance: 'Relevance',
  created_at: 'Date Created',
  is_public: 'Visibility',
  duration_minutes: 'Duration',
  title: 'Title',
  spice_level: 'Spice Level',
  difficulty: 'Difficulty',
};

export const DEFAULT_RECIPE_FILTER: RecipeFilter = {
  query: null,
  difficulty: null,
  spiceLevelMin: null,
  spiceLevelMax: null,
  durationMin: null,
  durationMax: null,
  servingsMin: null,
  servingsMax: null,
  origin: null,
  ingredientCategories: null,
  sortBy: 'created_at',
  sortOrder: 'desc',
  page: 1,
  pageSize: 20,
};

export const DEFAULT_FILTER_MODEL: FilterModel = {
  difficulty: null,
  spiceMax: null,
  duration: [...DURATION_RANGE],
  servings: [...SERVINGS_RANGE],
  origin: null,
  categories: null,
  sortBy: 'created_at',
  sortOrder: 'desc',
};
