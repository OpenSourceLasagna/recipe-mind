import { RecipeResponse } from '../models/recipe.model';
import { RecipeIngredientResponse } from '../models/ingredient.model';

export type DiffStatus = 'added' | 'removed' | 'unchanged' | 'modified';

export interface ScalarChange {
  before: unknown;
  after: unknown;
}

export interface IngredientDiffItem {
  status: DiffStatus;
  original: RecipeIngredientResponse | null;
  modified: RecipeIngredientResponse | null;
}

export interface TextListDiffItem {
  status: DiffStatus;
  index: number;
  original: string | null;
  modified: string | null;
}

export interface NutritionDiffItem {
  status: DiffStatus;
  key: string;
  original: unknown | null;
  modified: unknown | null;
}

export interface RecipeDiff {
  title: ScalarChange | null;
  servings: ScalarChange | null;
  durationMinutes: ScalarChange | null;
  difficulty: ScalarChange | null;
  spiceLevel: ScalarChange | null;
  origin: ScalarChange | null;
  isPublic: ScalarChange | null;
  ingredients: IngredientDiffItem[];
  instructionSteps: TextListDiffItem[];
  additionalInformation: TextListDiffItem[];
  nutrition: NutritionDiffItem[];
}

function scalarChanged(before: unknown, after: unknown): boolean {
  if (typeof before !== typeof after) return true;
  if (Array.isArray(before) && Array.isArray(after)) {
    return JSON.stringify(before) !== JSON.stringify(after);
  }
  if (typeof before === 'object' && before !== null && after !== null) {
    return JSON.stringify(before) !== JSON.stringify(after);
  }
  return before !== after;
}

function makeScalarChange(before: unknown, after: unknown): ScalarChange | null {
  return scalarChanged(before, after) ? { before, after } : null;
}

function diffIngredients(
  original: RecipeIngredientResponse[],
  modified: RecipeIngredientResponse[],
): IngredientDiffItem[] {
  const maxLen = Math.max(original.length, modified.length);
  const result: IngredientDiffItem[] = [];

  for (let i = 0; i < maxLen; i++) {
    const orig = original[i] ?? null;
    const mod = modified[i] ?? null;

    if (orig === null && mod !== null) {
      result.push({ status: 'added', original: null, modified: mod });
    } else if (orig !== null && mod === null) {
      result.push({ status: 'removed', original: orig, modified: null });
    } else if (
      orig !== null &&
      mod !== null &&
      (orig.ingredientName !== mod.ingredientName ||
        orig.quantity !== mod.quantity ||
        orig.unit !== mod.unit)
    ) {
      result.push({ status: 'modified', original: orig, modified: mod });
    } else {
      result.push({ status: 'unchanged', original: orig, modified: mod });
    }
  }

  return result;
}

function diffTextList(original: string[], modified: string[]): TextListDiffItem[] {
  const maxLen = Math.max(original.length, modified.length);
  const result: TextListDiffItem[] = [];

  for (let i = 0; i < maxLen; i++) {
    const orig = original[i] ?? null;
    const mod = modified[i] ?? null;

    let status: DiffStatus;
    if (orig === null && mod !== null) {
      status = 'added';
    } else if (orig !== null && mod === null) {
      status = 'removed';
    } else if (orig !== null && mod !== null && orig !== mod) {
      status = 'modified';
    } else {
      status = 'unchanged';
    }

    result.push({ status, index: i, original: orig, modified: mod });
  }

  return result;
}

function diffNutrition(
  original: Record<string, unknown>,
  modified: Record<string, unknown>,
): NutritionDiffItem[] {
  const allKeys = new Set([...Object.keys(original), ...Object.keys(modified)]);
  const result: NutritionDiffItem[] = [];

  for (const key of allKeys) {
    const origVal = key in original ? original[key] : null;
    const modVal = key in modified ? modified[key] : null;

    let status: DiffStatus;
    if (origVal === null && modVal !== null) {
      status = 'added';
    } else if (origVal !== null && modVal === null) {
      status = 'removed';
    } else if (origVal !== null && modVal !== null && !scalarChanged(origVal, modVal)) {
      status = 'unchanged';
    } else if (origVal !== null && modVal !== null) {
      status = 'modified';
    } else {
      status = 'unchanged';
    }

    result.push({ status, key, original: origVal, modified: modVal });
  }

  return result;
}

export function computeRecipeDiff(original: RecipeResponse, modified: RecipeResponse): RecipeDiff {
  return {
    title: makeScalarChange(original.title, modified.title),
    servings: makeScalarChange(original.servings, modified.servings),
    durationMinutes: makeScalarChange(original.durationMinutes, modified.durationMinutes),
    difficulty: makeScalarChange(original.difficulty, modified.difficulty),
    spiceLevel: makeScalarChange(original.spiceLevel, modified.spiceLevel),
    origin: makeScalarChange(original.origin, modified.origin),
    isPublic: makeScalarChange(original.isPublic, modified.isPublic),
    ingredients: diffIngredients(original.ingredients, modified.ingredients),
    instructionSteps: diffTextList(original.instructionSteps, modified.instructionSteps),
    additionalInformation: diffTextList(
      original.additionalInformation,
      modified.additionalInformation,
    ),
    nutrition: diffNutrition(
      original.nutrition as Record<string, unknown>,
      modified.nutrition as Record<string, unknown>,
    ),
  };
}

export function hasAnyChanges(diff: RecipeDiff): boolean {
  return (
    diff.title !== null ||
    diff.servings !== null ||
    diff.durationMinutes !== null ||
    diff.difficulty !== null ||
    diff.spiceLevel !== null ||
    diff.origin !== null ||
    diff.isPublic !== null ||
    diff.ingredients.some((i) => i.status !== 'unchanged') ||
    diff.instructionSteps.some((s) => s.status !== 'unchanged') ||
    diff.additionalInformation.some((a) => a.status !== 'unchanged') ||
    diff.nutrition.some((n) => n.status !== 'unchanged')
  );
}

export function isSectionChanged(diff: RecipeDiff, section: string): boolean {
  switch (section) {
    case 'title':
      return diff.title !== null;
    case 'servings':
      return diff.servings !== null;
    case 'durationMinutes':
      return diff.durationMinutes !== null;
    case 'difficulty':
      return diff.difficulty !== null;
    case 'spiceLevel':
      return diff.spiceLevel !== null;
    case 'origin':
      return diff.origin !== null;
    case 'isPublic':
      return diff.isPublic !== null;
    case 'ingredients':
      return diff.ingredients.some((i) => i.status !== 'unchanged');
    case 'instructionSteps':
      return diff.instructionSteps.some((s) => s.status !== 'unchanged');
    case 'additionalInformation':
      return diff.additionalInformation.some((a) => a.status !== 'unchanged');
    case 'nutrition':
      return diff.nutrition.some((n) => n.status !== 'unchanged');
    default:
      return false;
  }
}

const SCALAR_FIELDS = [
  'title',
  'servings',
  'durationMinutes',
  'difficulty',
  'spiceLevel',
  'origin',
  'isPublic',
] as const;

const COMPLEX_FIELDS = [
  'additionalInformation',
  'ingredients',
  'instructionSteps',
  'nutrition',
] as const;

export function getChangedFieldNames(
  original: RecipeResponse,
  modified: RecipeResponse,
): Set<string> {
  const changed = new Set<string>();

  for (const field of SCALAR_FIELDS) {
    if (original[field] !== modified[field]) {
      changed.add(field);
    }
  }

  if (
    JSON.stringify(original.additionalInformation) !==
    JSON.stringify(modified.additionalInformation)
  ) {
    changed.add('additionalInformation');
  }
  if (JSON.stringify(original.ingredients) !== JSON.stringify(modified.ingredients)) {
    changed.add('ingredients');
  }
  if (JSON.stringify(original.instructionSteps) !== JSON.stringify(modified.instructionSteps)) {
    changed.add('instructionSteps');
  }
  if (JSON.stringify(original.nutrition) !== JSON.stringify(modified.nutrition)) {
    changed.add('nutrition');
  }

  return changed;
}
