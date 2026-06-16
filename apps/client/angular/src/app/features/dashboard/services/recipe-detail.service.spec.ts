import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { RecipeDetailService } from './recipe-detail.service';
import { RecipeDetailResponse } from '../models/recipe-detail.model';

function makeRecipeDetail(overrides: Partial<RecipeDetailResponse> = {}): RecipeDetailResponse {
  return {
    id: 'recipe-1',
    title: 'Test Recipe',
    additionalInformation: [],
    instructionSteps: ['step 1'],
    nutrition: { calories: 500 },
    servings: 4,
    durationMinutes: 30,
    difficulty: 'easy',
    spiceLevel: 2,
    origin: 'Italian',
    isPublic: true,
    ingredients: [],
    isOwner: true,
    modifiedRecipe: null,
    ...overrides,
  } as RecipeDetailResponse;
}

describe('RecipeDetailService', () => {
  let service: RecipeDetailService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(RecipeDetailService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('initial state', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should start with no recipe id', () => {
      expect(service.currentRecipeId()).toBeNull();
    });

    it('should not be editing initially', () => {
      expect(service.isEditing()).toBe(false);
    });

    it('should be in original view mode initially', () => {
      expect(service.viewMode()).toBe('original');
    });

    it('should have no save error initially', () => {
      expect(service.saveError()).toBeNull();
    });

    it('should not have modified recipe initially', () => {
      expect(service.hasModified()).toBe(false);
    });

    it('should not be owner initially', () => {
      expect(service.isOwner()).toBe(false);
    });
  });

  describe('setRecipeId', () => {
    it('should set the current recipe id', () => {
      service.setRecipeId('abc-123');

      expect(service.currentRecipeId()).toBe('abc-123');
    });

    it('should reset isEditing to false', () => {
      service.setRecipeId('abc-123');
      service.isEditing.set(true);

      service.setRecipeId('xyz-789');

      expect(service.isEditing()).toBe(false);
    });

    it('should reset viewMode to original', () => {
      service.setRecipeId('abc-123');
      service.viewMode.set('modified');

      service.setRecipeId('xyz-789');

      expect(service.viewMode()).toBe('original');
    });

    it('should clear saveError', () => {
      service.setRecipeId('abc-123');

      service.setRecipeId('xyz-789');

      expect(service.saveError()).toBeNull();
    });
  });

  describe('toggleEdit', () => {
    it('should flip isEditing from false to true', () => {
      service.toggleEdit();

      expect(service.isEditing()).toBe(true);
    });

    it('should flip isEditing from true to false', () => {
      service.toggleEdit();
      service.toggleEdit();

      expect(service.isEditing()).toBe(false);
    });

    it('should clear save error', () => {
      service.toggleEdit();
      service.toggleEdit();
      service.toggleEdit();

      expect(service.saveError()).toBeNull();
    });
  });

  describe('cancelEdit', () => {
    it('should set isEditing to false', () => {
      service.isEditing.set(true);
      service.cancelEdit();

      expect(service.isEditing()).toBe(false);
    });
  });

  describe('setViewMode', () => {
    it('should set view mode to modified', () => {
      service.setViewMode('modified');

      expect(service.viewMode()).toBe('modified');
    });
  });

  describe('activeRecipe', () => {
    it('should return undefined when no recipe is loaded', () => {
      expect(service.activeRecipe()).toBeUndefined();
    });
  });

  describe('hasModified', () => {
    it('should be false when no recipe is loaded', () => {
      expect(service.hasModified()).toBe(false);
    });
  });

  describe('changedFields', () => {
    it('should be empty when no recipe is loaded', () => {
      expect(service.changedFields().size).toBe(0);
    });
  });

  describe('isOwner', () => {
    it('should be false when no recipe is loaded', () => {
      expect(service.isOwner()).toBe(false);
    });
  });

  describe('changedFields with synthetic detail', () => {
    it('should detect title change via JSON-level comparison logic', () => {
      const original = makeRecipeDetail({ id: 'r1', title: 'Old' });
      const modified = { ...original, title: 'New' };
      const detail = { ...original, modifiedRecipe: modified };

      (service.recipe as any).value.set(detail);

      const changed = service.changedFields();
      expect(changed.has('title')).toBe(true);
    });

    it('should detect multiple field changes', () => {
      const original = makeRecipeDetail({ id: 'r1', title: 'A', servings: 4 });
      const modified = { ...original, title: 'B', servings: 8 };
      const detail = { ...original, modifiedRecipe: modified };

      (service.recipe as any).value.set(detail);

      const changed = service.changedFields();
      expect(changed.has('title')).toBe(true);
      expect(changed.has('servings')).toBe(true);
    });

    it('should detect ingredients change via JSON comparison', () => {
      const original = makeRecipeDetail({ id: 'r1', ingredients: [] });
      const modified = {
        ...original,
        ingredients: [{ id: 'i1', ingredientName: 'tomato', quantity: 2, unit: 'cups' }],
      };
      const detail = { ...original, modifiedRecipe: modified };

      (service.recipe as any).value.set(detail);

      expect(service.changedFields().has('ingredients')).toBe(true);
    });

    it('should return empty Set when modifiedRecipe is null', () => {
      const detail = makeRecipeDetail({ id: 'r1', modifiedRecipe: null });
      (service.recipe as any).value.set(detail);

      expect(service.changedFields().size).toBe(0);
    });
  });

  describe('activeRecipe with synthetic detail', () => {
    it('should return the detail recipe in original mode', () => {
      const detail = makeRecipeDetail({ id: 'r1' });
      (service.recipe as any).value.set(detail);

      expect(service.activeRecipe()).toEqual(detail);
    });

    it('should return modified recipe when in modified mode', () => {
      const modified = { ...makeRecipeDetail({ id: 'r1' }), title: 'Modified Title' };
      const detail = makeRecipeDetail({ id: 'r1', modifiedRecipe: modified });
      (service.recipe as any).value.set(detail);

      service.setViewMode('modified');

      expect(service.activeRecipe()?.title).toBe('Modified Title');
    });
  });

  describe('hasModified with synthetic detail', () => {
    it('should be true when modifiedRecipe is present', () => {
      const detail = makeRecipeDetail({
        id: 'r1',
        modifiedRecipe: makeRecipeDetail({ title: 'Modified' }),
      });
      (service.recipe as any).value.set(detail);

      expect(service.hasModified()).toBe(true);
    });

    it('should be false when modifiedRecipe is null', () => {
      const detail = makeRecipeDetail({ id: 'r1', modifiedRecipe: null });
      (service.recipe as any).value.set(detail);

      expect(service.hasModified()).toBe(false);
    });
  });

  describe('isOwner with synthetic detail', () => {
    it('should reflect the detail isOwner', () => {
      (service.recipe as any).value.set(makeRecipeDetail({ isOwner: true }));
      expect(service.isOwner()).toBe(true);

      (service.recipe as any).value.set(makeRecipeDetail({ isOwner: false }));
      expect(service.isOwner()).toBe(false);
    });
  });

  describe('saveEdit', () => {
    it('should be a no-op when no recipe id is set', async () => {
      await expect(service.saveEdit({ title: 'x' })).resolves.toBeUndefined();
      httpMock.expectNone((r) => r.method === 'PATCH');
    });
  });
});
