import {
  computeRecipeDiff,
  getChangedFieldNames,
  hasAnyChanges,
  isSectionChanged,
  RecipeDiff,
} from './recipe-diff.utils';
import { RecipeResponse } from '../models/recipe.model';
import { RecipeIngredientResponse } from '../models/ingredient.model';

function makeRecipe(overrides: Partial<RecipeResponse> = {}): RecipeResponse {
  return {
    id: 'test-id',
    title: 'Test Recipe',
    additionalInformation: ['Contains nuts'],
    instructionSteps: ['Step 1', 'Step 2'],
    nutrition: { calories: 300, protein: '20g' },
    servings: 4,
    durationMinutes: 30,
    difficulty: 'medium',
    spiceLevel: 2,
    origin: 'Italian',
    isPublic: false,
    ingredients: [
      { id: 'i-1', ingredientName: 'Flour', quantity: 2, unit: 'cups', categoryId: null },
      { id: 'i-2', ingredientName: 'Eggs', quantity: 3, unit: 'pieces', categoryId: null },
    ],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('computeRecipeDiff', () => {
  describe('identical recipes', () => {
    it('should return no changes for identical recipes', () => {
      const recipe = makeRecipe();
      const diff = computeRecipeDiff(recipe, recipe);

      expect(diff.title).toBeNull();
      expect(diff.servings).toBeNull();
      expect(diff.durationMinutes).toBeNull();
      expect(diff.difficulty).toBeNull();
      expect(diff.spiceLevel).toBeNull();
      expect(diff.origin).toBeNull();
      expect(diff.isPublic).toBeNull();
      expect(diff.ingredients.every((i) => i.status === 'unchanged')).toBe(true);
      expect(diff.instructionSteps.every((s) => s.status === 'unchanged')).toBe(true);
      expect(diff.additionalInformation.every((a) => a.status === 'unchanged')).toBe(true);
      expect(diff.nutrition.every((n) => n.status === 'unchanged')).toBe(true);
    });

    it('should have no changes when ingredients are identical', () => {
      const recipe = makeRecipe();
      const diff = computeRecipeDiff(recipe, recipe);
      expect(hasAnyChanges(diff)).toBe(false);
    });
  });

  describe('scalar fields', () => {
    it('should detect title change', () => {
      const diff = computeRecipeDiff(makeRecipe(), makeRecipe({ title: 'New Title' }));
      expect(diff.title).toEqual({ before: 'Test Recipe', after: 'New Title' });
    });

    it('should detect servings change', () => {
      const diff = computeRecipeDiff(makeRecipe(), makeRecipe({ servings: 6 }));
      expect(diff.servings).toEqual({ before: 4, after: 6 });
    });

    it('should detect difficulty change', () => {
      const diff = computeRecipeDiff(makeRecipe(), makeRecipe({ difficulty: 'hard' }));
      expect(diff.difficulty).toEqual({ before: 'medium', after: 'hard' });
    });

    it('should detect spiceLevel change', () => {
      const diff = computeRecipeDiff(makeRecipe(), makeRecipe({ spiceLevel: 5 }));
      expect(diff.spiceLevel).toEqual({ before: 2, after: 5 });
    });

    it('should detect origin change', () => {
      const diff = computeRecipeDiff(makeRecipe(), makeRecipe({ origin: 'French' }));
      expect(diff.origin).toEqual({ before: 'Italian', after: 'French' });
    });

    it('should detect isPublic change', () => {
      const diff = computeRecipeDiff(makeRecipe(), makeRecipe({ isPublic: true }));
      expect(diff.isPublic).toEqual({ before: false, after: true });
    });
  });

  describe('ingredients', () => {
    it('should detect added ingredient', () => {
      const orig = makeRecipe();
      const newIng: RecipeIngredientResponse = {
        id: 'i-3',
        ingredientName: 'Sugar',
        quantity: 1,
        unit: 'cup',
        categoryId: null,
      };
      const mod = makeRecipe({ ingredients: [...orig.ingredients, newIng] });
      const diff = computeRecipeDiff(orig, mod);

      expect(diff.ingredients).toHaveLength(3);
      expect(diff.ingredients[0].status).toBe('unchanged');
      expect(diff.ingredients[1].status).toBe('unchanged');
      expect(diff.ingredients[2].status).toBe('added');
      expect(diff.ingredients[2].modified!.ingredientName).toBe('Sugar');
    });

    it('should detect removed ingredient', () => {
      const orig = makeRecipe();
      const mod = makeRecipe({ ingredients: [orig.ingredients[0]] });
      const diff = computeRecipeDiff(orig, mod);

      expect(diff.ingredients).toHaveLength(2);
      expect(diff.ingredients[0].status).toBe('unchanged');
      expect(diff.ingredients[1].status).toBe('removed');
    });

    it('should detect modified ingredient', () => {
      const orig = makeRecipe();
      const mod = makeRecipe({
        ingredients: [
          { ...orig.ingredients[0], quantity: 3, unit: 'cups' },
          orig.ingredients[1],
        ],
      });
      const diff = computeRecipeDiff(orig, mod);

      expect(diff.ingredients[0].status).toBe('modified');
      expect(diff.ingredients[0].original!.quantity).toBe(2);
      expect(diff.ingredients[0].modified!.quantity).toBe(3);
    });

    it('should handle name change as modified', () => {
      const orig = makeRecipe();
      const mod = makeRecipe({
        ingredients: [{ ...orig.ingredients[0], ingredientName: 'Whole Wheat Flour' }],
      });
      const diff = computeRecipeDiff(orig, mod);

      expect(diff.ingredients[0].status).toBe('modified');
    });
  });

  describe('instruction steps', () => {
    it('should detect added step', () => {
      const diff = computeRecipeDiff(
        makeRecipe(),
        makeRecipe({ instructionSteps: ['Step 1', 'Step 2', 'Step 3'] }),
      );

      expect(diff.instructionSteps).toHaveLength(3);
      expect(diff.instructionSteps[2].status).toBe('added');
      expect(diff.instructionSteps[2].modified).toBe('Step 3');
    });

    it('should detect removed step', () => {
      const diff = computeRecipeDiff(
        makeRecipe(),
        makeRecipe({ instructionSteps: ['Step 1'] }),
      );

      expect(diff.instructionSteps[1].status).toBe('removed');
    });

    it('should detect modified step', () => {
      const diff = computeRecipeDiff(
        makeRecipe(),
        makeRecipe({ instructionSteps: ['Step 1', 'Modified step 2'] }),
      );

      expect(diff.instructionSteps[1].status).toBe('modified');
      expect(diff.instructionSteps[1].original).toBe('Step 2');
      expect(diff.instructionSteps[1].modified).toBe('Modified step 2');
    });
  });

  describe('nutrition', () => {
    it('should detect added nutrition entry', () => {
      const diff = computeRecipeDiff(
        makeRecipe(),
        makeRecipe({ nutrition: { calories: 300, protein: '20g', carbs: '50g' } }),
      );

      const carbs = diff.nutrition.find((n) => n.key === 'carbs');
      expect(carbs!.status).toBe('added');
      expect(carbs!.original).toBeNull();
      expect(carbs!.modified).toBe('50g');
    });

    it('should detect removed nutrition entry', () => {
      const diff = computeRecipeDiff(
        makeRecipe(),
        makeRecipe({ nutrition: { calories: 300 } }),
      );

      const protein = diff.nutrition.find((n) => n.key === 'protein');
      expect(protein!.status).toBe('removed');
    });

    it('should detect modified nutrition value', () => {
      const diff = computeRecipeDiff(
        makeRecipe(),
        makeRecipe({ nutrition: { calories: 450, protein: '20g' } }),
      );

      const calories = diff.nutrition.find((n) => n.key === 'calories');
      expect(calories!.status).toBe('modified');
      expect(calories!.original).toBe(300);
      expect(calories!.modified).toBe(450);
    });
  });

  describe('additional information', () => {
    it('should detect added info', () => {
      const diff = computeRecipeDiff(
        makeRecipe(),
        makeRecipe({ additionalInformation: ['Contains nuts', 'Gluten-free'] }),
      );

      expect(diff.additionalInformation[1].status).toBe('added');
    });

    it('should detect removed info', () => {
      const diff = computeRecipeDiff(
        makeRecipe(),
        makeRecipe({ additionalInformation: [] }),
      );

      expect(diff.additionalInformation[0].status).toBe('removed');
    });
  });
});

describe('hasAnyChanges', () => {
  it('should return false for identical recipes', () => {
    const recipe = makeRecipe();
    expect(hasAnyChanges(computeRecipeDiff(recipe, recipe))).toBe(false);
  });

  it('should return true for scalar change', () => {
    expect(hasAnyChanges(computeRecipeDiff(makeRecipe(), makeRecipe({ title: 'New' })))).toBe(true);
  });

  it('should return true for ingredient change', () => {
    const orig = makeRecipe();
    const mod = makeRecipe({ ingredients: [{ ...orig.ingredients[0], quantity: 10 }] });
    expect(hasAnyChanges(computeRecipeDiff(orig, mod))).toBe(true);
  });
});

describe('isSectionChanged', () => {
  it('should detect title section change', () => {
    const diff = computeRecipeDiff(makeRecipe(), makeRecipe({ title: 'New' }));
    expect(isSectionChanged(diff, 'title')).toBe(true);
    expect(isSectionChanged(diff, 'servings')).toBe(false);
  });

  it('should detect ingredient section change', () => {
    const orig = makeRecipe();
    const mod = makeRecipe({ ingredients: [{ ...orig.ingredients[0], quantity: 10 }] });
    const diff = computeRecipeDiff(orig, mod);
    expect(isSectionChanged(diff, 'ingredients')).toBe(true);
  });

  it('should return false for unknown section', () => {
    const recipe = makeRecipe();
    expect(isSectionChanged(computeRecipeDiff(recipe, recipe), 'nonexistent')).toBe(false);
  });
});

describe('getChangedFieldNames', () => {
  it('should return empty set for identical recipes', () => {
    const recipe = makeRecipe();
    expect(getChangedFieldNames(recipe, recipe).size).toBe(0);
  });

  it('should detect title change', () => {
    const fields = getChangedFieldNames(makeRecipe(), makeRecipe({ title: 'New' }));
    expect(fields.has('title')).toBe(true);
    expect(fields.size).toBe(1);
  });

  it('should detect all scalar fields', () => {
    const fields = getChangedFieldNames(
      makeRecipe(),
      makeRecipe({ title: 'X', servings: 8, durationMinutes: 45, difficulty: 'hard', spiceLevel: 5, origin: 'French', isPublic: true }),
    );
    expect(fields.has('title')).toBe(true);
    expect(fields.has('servings')).toBe(true);
    expect(fields.has('durationMinutes')).toBe(true);
    expect(fields.has('difficulty')).toBe(true);
    expect(fields.has('spiceLevel')).toBe(true);
    expect(fields.has('origin')).toBe(true);
    expect(fields.has('isPublic')).toBe(true);
  });

  it('should detect ingredient list changes', () => {
    const orig = makeRecipe();
    const mod = makeRecipe({
      ingredients: [{ ...orig.ingredients[0], quantity: 10 }],
    });
    const fields = getChangedFieldNames(orig, mod);
    expect(fields.has('ingredients')).toBe(true);
  });

  it('should detect instruction step changes', () => {
    const fields = getChangedFieldNames(
      makeRecipe(),
      makeRecipe({ instructionSteps: ['New step'] }),
    );
    expect(fields.has('instructionSteps')).toBe(true);
  });

  it('should detect nutrition changes', () => {
    const fields = getChangedFieldNames(
      makeRecipe(),
      makeRecipe({ nutrition: { calories: 500 } }),
    );
    expect(fields.has('nutrition')).toBe(true);
  });
});

describe('ingredient diff edge cases', () => {
  it('should handle AI adding ingredients (longer modified list)', () => {
    const orig = makeRecipe({ ingredients: [{ id: 'i-1', ingredientName: 'A', quantity: 1, unit: 'cup', categoryId: null }] });
    const mod = makeRecipe({
      ingredients: [
        { id: 'i-1', ingredientName: 'A', quantity: 1, unit: 'cup', categoryId: null },
        { id: 'i-new', ingredientName: 'B', quantity: 2, unit: 'tbsp', categoryId: null },
      ],
    });
    const diff = computeRecipeDiff(orig, mod);
    expect(diff.ingredients).toHaveLength(2);
    expect(diff.ingredients[0].status).toBe('unchanged');
    expect(diff.ingredients[1].status).toBe('added');
    expect(diff.ingredients[1].modified!.ingredientName).toBe('B');
  });

  it('should handle AI removing all ingredients', () => {
    const orig = makeRecipe();
    const mod = makeRecipe({ ingredients: [] });
    const diff = computeRecipeDiff(orig, mod);
    expect(diff.ingredients.every((i) => i.status === 'removed')).toBe(true);
  });

  it('should handle positional diff (insert at position 0 shifts all)', () => {
    const orig = makeRecipe({
      ingredients: [
        { id: 'i-1', ingredientName: 'A', quantity: 1, unit: 'cup', categoryId: null },
        { id: 'i-2', ingredientName: 'B', quantity: 2, unit: 'cup', categoryId: null },
      ],
    });
    const mod = makeRecipe({
      ingredients: [
        { id: 'i-new', ingredientName: 'C', quantity: 3, unit: 'cup', categoryId: null },
        { id: 'i-1', ingredientName: 'A', quantity: 1, unit: 'cup', categoryId: null },
        { id: 'i-2', ingredientName: 'B', quantity: 2, unit: 'cup', categoryId: null },
      ],
    });
    const diff = computeRecipeDiff(orig, mod);
    expect(diff.ingredients).toHaveLength(3);
    expect(diff.ingredients[0].status).toBe('modified');
    expect(diff.ingredients[1].status).toBe('modified');
    expect(diff.ingredients[2].status).toBe('added');
  });
});

describe('instruction diff edge cases', () => {
  it('should handle completely different instructions', () => {
    const diff = computeRecipeDiff(
      makeRecipe({ instructionSteps: ['Step 1', 'Step 2'] }),
      makeRecipe({ instructionSteps: ['New A', 'New B', 'New C'] }),
    );
    expect(diff.instructionSteps).toHaveLength(3);
    expect(diff.instructionSteps[0].status).toBe('modified');
    expect(diff.instructionSteps[1].status).toBe('modified');
    expect(diff.instructionSteps[2].status).toBe('added');
  });
});
