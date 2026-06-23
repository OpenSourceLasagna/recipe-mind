import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { RecipeCreationStore } from './recipe-creation.store';
import { RecipeService } from './recipe.service';
import { IngredientEditRow } from '../../../shared/models/ingredient-edit-row.model';

describe('RecipeCreationStore', () => {
  let store: RecipeCreationStore;
  let httpMock: HttpTestingController;
  let recipeService: RecipeService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    store = TestBed.inject(RecipeCreationStore);
    recipeService = TestBed.inject(RecipeService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('initial state', () => {
    it('should be created', () => {
      expect(store).toBeTruthy();
    });

    it('should start with link method active', () => {
      expect(store.activeMethod()).toBe('link');
    });

    it('should have empty url and raw text inputs', () => {
      expect(store.urlInput()).toBe('');
      expect(store.rawTextInput()).toBe('');
    });

    it('should have one empty ingredient row by default', () => {
      expect(store.editorIngredients().length).toBe(1);
      expect(store.editorIngredients()[0].ingredientName).toBe('');
    });

    it('should have untouched ingredients', () => {
      expect(store.editorIngredientsTouched()).toBe(false);
    });
  });

  describe('setActiveMethod', () => {
    it('should change the active method', () => {
      store.setActiveMethod('editor');
      expect(store.activeMethod()).toBe('editor');

      store.setActiveMethod('text');
      expect(store.activeMethod()).toBe('text');
    });
  });

  describe('ingredientsValid', () => {
    it('should be invalid when list is empty', () => {
      store.editorIngredients.set([]);

      const result = store.ingredientsValid();
      expect(result.valid).toBe(false);
      expect(result.message).toContain('at least one ingredient');
    });

    it('should be valid when all ingredients have name and positive quantity', () => {
      store.editorIngredients.set([
        { ingredientName: 'tomato', quantity: 2, unit: 'cups' },
        { ingredientName: 'basil', quantity: 1, unit: 'tbsp' },
      ]);

      expect(store.ingredientsValid().valid).toBe(true);
    });

    it('should be invalid when an ingredient has empty name', () => {
      store.editorIngredients.set([{ ingredientName: '   ', quantity: 2, unit: 'cups' }]);

      const result = store.ingredientsValid();
      expect(result.valid).toBe(false);
      expect(result.message).toContain('name');
    });

    it('should be invalid when an ingredient has zero quantity', () => {
      store.editorIngredients.set([{ ingredientName: 'tomato', quantity: 0, unit: 'cups' }]);

      expect(store.ingredientsValid().valid).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset method to link', () => {
      store.setActiveMethod('editor');
      store.reset();

      expect(store.activeMethod()).toBe('link');
    });

    it('should clear all input fields', () => {
      store.urlInput.set('https://example.com');
      store.rawTextInput.set('some text');

      store.reset();

      expect(store.urlInput()).toBe('');
      expect(store.rawTextInput()).toBe('');
    });

    it('should reset ingredients to one empty row', () => {
      store.editorIngredients.set([{ ingredientName: 'tomato', quantity: 2, unit: 'cups' }]);

      store.reset();

      expect(store.editorIngredients().length).toBe(1);
      expect(store.editorIngredients()[0].ingredientName).toBe('');
    });
  });

  describe('buildRequest', () => {
    it('should filter out ingredients with empty names', () => {
      const rows: IngredientEditRow[] = [
        { ingredientName: 'tomato', quantity: 2, unit: 'cups' },
        { ingredientName: '   ', quantity: 1, unit: 'tbsp' },
      ];
      store.editorIngredients.set(rows);
      store.editorModel.set({ ...store.editorModel(), title: 'Test' });

      const request = store.buildRequest();

      expect(request.ingredients.length).toBe(1);
      expect(request.ingredients[0].ingredientName).toBe('tomato');
    });

    it('should trim ingredient names and units', () => {
      store.editorIngredients.set([
        { ingredientName: '  tomato  ', quantity: 2, unit: '  cups  ' },
      ]);

      const request = store.buildRequest();

      expect(request.ingredients[0].ingredientName).toBe('tomato');
      expect(request.ingredients[0].unit).toBe('cups');
    });

    it('should filter empty instruction steps', () => {
      store.editorModel.set({ ...store.editorModel(), title: 'Test' });
      store.editInstructions.set(['step 1', 'step 2', '', '  ', 'step 3']);

      const request = store.buildRequest();

      expect(request.instructionSteps).toEqual(['step 1', 'step 2', 'step 3']);
    });

    it('should parse nutrition values that are numbers', () => {
      store.editorModel.set({
        ...store.editorModel(),
        title: 'Test',
        calories: '500',
        protein: '25',
        carbs: '60',
        fat: '20',
      });

      const request = store.buildRequest();

      expect(request.nutrition).toEqual({
        calories: 500,
        protein: 25,
        carbs: 60,
        fat: 20,
      });
    });

    it('should skip non-numeric nutrition values', () => {
      store.editorModel.set({
        ...store.editorModel(),
        title: 'Test',
        calories: '500',
        protein: 'not a number',
        carbs: '0',
        fat: '0',
      });

      const request = store.buildRequest();

      expect(request.nutrition).toEqual({
        calories: 500,
        carbs: 0,
        fat: 0,
      });
    });

    it('should use Unknown origin when blank', () => {
      store.editorModel.set({ ...store.editorModel(), origin: '   ' });

      const request = store.buildRequest();

      expect(request.origin).toBe('Unknown');
    });

    it('should default to "Unknown" origin when empty', () => {
      store.editorModel.set({ ...store.editorModel(), origin: '' });

      const request = store.buildRequest();

      expect(request.origin).toBe('Unknown');
    });
  });

  describe('submitCurrentMode', () => {
    it('should call addStructuredRecipe for editor mode', () => {
      store.setActiveMethod('editor');
      store.editorModel.set({ ...store.editorModel(), title: 'Editor Recipe' });
      store.editorIngredients.set([{ ingredientName: 'tomato', quantity: 2, unit: 'cups' }]);

      store.submitCurrentMode().subscribe();

      const req = httpMock.expectOne((r) => r.url.includes('/structured'));
      expect(req.request.method).toBe('POST');
      req.flush({ id: 'new-id' });
    });

    it('should call extract for link mode', () => {
      store.setActiveMethod('link');
      store.urlInput.set('https://example.com/recipe');

      store.submitCurrentMode().subscribe();

      const req = httpMock.expectOne((r) => r.url.includes('/extract'));
      expect(req.request.method).toBe('POST');
      expect(req.request.body.source).toBe('url');
      expect(req.request.body.content).toBe('https://example.com/recipe');
      const extracted = {
        title: 'Extracted Recipe',
        ingredients: [{ ingredientName: 'tomato', quantity: 2, unit: 'cups' }],
        additionalInformation: [],
        instructionSteps: ['Step 1'],
        nutrition: {},
        servings: 4,
        durationMinutes: 30,
        difficulty: 'easy',
        spiceLevel: 1,
        origin: 'Unknown',
        isPublic: false,
      };
      req.flush(extracted);
    });

    it('should call addTextRecipe for text mode', () => {
      store.setActiveMethod('text');
      store.rawTextInput.set('Some recipe text');

      store.submitCurrentMode().subscribe();

      const req = httpMock.expectOne((r) => r.url.includes('/extract'));
      expect(req.request.method).toBe('POST');
      expect(req.request.body.source).toBe('text');
      expect(req.request.body.content).toBe('Some recipe text');
      const extracted = {
        title: 'Extracted Recipe',
        ingredients: [{ ingredientName: 'tomato', quantity: 2, unit: 'cups' }],
        additionalInformation: [],
        instructionSteps: ['Step 1'],
        nutrition: {},
        servings: 4,
        durationMinutes: 30,
        difficulty: 'easy',
        spiceLevel: 1,
        origin: 'Italian',
        isPublic: false,
      };
      req.flush(extracted);
    });

    it('should throw for image mode', () => {
      store.setActiveMethod('image');
      expect(() => store.submitCurrentMode()).toThrow();
    });
  });

  describe('extract', () => {
    it('should call extract endpoint and populate editor on text success', () => {
      const extracted = {
        title: 'Pasta Carbonara',
        ingredients: [
          { ingredientName: 'spaghetti', quantity: 400, unit: 'g' },
          { ingredientName: 'eggs', quantity: 3, unit: '' },
          { ingredientName: 'pecorino', quantity: 100, unit: 'g' },
        ],
        additionalInformation: ['Use room temperature eggs'],
        instructionSteps: ['Boil pasta', 'Mix eggs and cheese', 'Combine and toss'],
        nutrition: { calories: 450, protein: 20, carbs: 55, fat: 18 },
        servings: 4,
        durationMinutes: 25,
        difficulty: 'medium',
        spiceLevel: 2,
        origin: 'Italian',
        isPublic: true,
      };

      store.setActiveMethod('text');
      store.rawTextInput.set('Pasta Carbonara recipe...');

      store.extract('text', store.rawTextInput()).subscribe();

      const req = httpMock.expectOne((r) => r.url.includes('/extract'));
      expect(req.request.body.source).toBe('text');
      req.flush(extracted);

      expect(store.activeMethod()).toBe('editor');
      expect(store.isExtracting()).toBe(false);
      expect(store.extractionError()).toBeNull();
      expect(store.editorModel().title).toBe('Pasta Carbonara');
      expect(store.editorModel().servings).toBe(4);
      expect(store.editorModel().difficulty).toBe('medium');
      expect(store.editorModel().origin).toBe('Italian');
      expect(store.editInstructions()).toEqual([
        'Boil pasta',
        'Mix eggs and cheese',
        'Combine and toss',
      ]);
      expect(store.editAdditionalInfo()).toEqual(['Use room temperature eggs']);
      expect(store.editorModel().calories).toBe('450');
      expect(store.editorIngredients().length).toBe(3);
      expect(store.editorIngredients()[0].ingredientName).toBe('spaghetti');
      expect(store.editorIngredientsTouched()).toBe(true);
    });

    it('should call extract endpoint with image source', () => {
      const extracted = {
        title: 'Image Recipe',
        ingredients: [{ ingredientName: 'rice', quantity: 1, unit: 'cup' }],
        additionalInformation: [],
        instructionSteps: ['Cook rice'],
        nutrition: {},
        servings: 2,
        durationMinutes: 20,
        difficulty: 'easy',
        spiceLevel: 2,
        origin: 'Unknown',
        isPublic: false,
      };

      store.setActiveMethod('image');
      store.extract('image', 'base64imagedata').subscribe();

      const req = httpMock.expectOne((r) => r.url.includes('/extract'));
      expect(req.request.body.source).toBe('image');
      expect(req.request.body.content).toBe('base64imagedata');
      req.flush(extracted);

      expect(store.activeMethod()).toBe('editor');
    });

    it('should set extraction error on failure', () => {
      store.setActiveMethod('text');
      store.rawTextInput.set('bad text');

      store.extract('text', store.rawTextInput()).subscribe({
        error: () => {},
      });

      const req = httpMock.expectOne((r) => r.url.includes('/extract'));
      req.flush({ detail: 'Failed to parse' }, { status: 502, statusText: 'Bad Gateway' });

      expect(store.isExtracting()).toBe(false);
      expect(store.extractionError()).toBe('Failed to parse');
      expect(store.activeMethod()).toBe('text');
    });
  });

  describe('populateFromExtraction', () => {
    it('should populate all fields from a full extraction result', () => {
      store.populateFromExtraction({
        title: 'Full Recipe',
        ingredients: [
          { ingredientName: 'flour', quantity: 2, unit: 'cups' },
          { ingredientName: 'milk', quantity: 1, unit: 'cup' },
        ],
        additionalInformation: ['Serve warm', 'Freezes well'],
        instructionSteps: ['Mix dry ingredients', 'Add wet ingredients', 'Bake at 350F'],
        nutrition: { calories: 300, protein: 8, carbs: 45, fat: 12 },
        servings: 6,
        durationMinutes: 45,
        difficulty: 'medium',
        spiceLevel: 2,
        origin: 'French',
        isPublic: true,
      });

      expect(store.editorModel().title).toBe('Full Recipe');
      expect(store.editorModel().origin).toBe('French');
      expect(store.editorModel().servings).toBe(6);
      expect(store.editorModel().durationMinutes).toBe(45);
      expect(store.editorModel().difficulty).toBe('medium');
      expect(store.editorModel().spiceLevel).toBe(2);
      expect(store.editorModel().isPublic).toBe(true);
      expect(store.editInstructions()).toEqual([
        'Mix dry ingredients',
        'Add wet ingredients',
        'Bake at 350F',
      ]);
      expect(store.editAdditionalInfo()).toEqual(['Serve warm', 'Freezes well']);
      expect(store.editorModel().calories).toBe('300');
      expect(store.editorModel().protein).toBe('8');
      expect(store.editorModel().carbs).toBe('45');
      expect(store.editorModel().fat).toBe('12');
      expect(store.editorIngredients().length).toBe(2);
      expect(store.editorIngredients()[0].ingredientName).toBe('flour');
      expect(store.editorIngredients()[0].quantity).toBe(2);
      expect(store.editorIngredients()[0].unit).toBe('cups');
      expect(store.editorIngredientsTouched()).toBe(true);
    });

    it('should use defaults for missing fields', () => {
      store.populateFromExtraction({
        title: 'Minimal',
        ingredients: [],
        additionalInformation: [],
        instructionSteps: [],
        nutrition: {},
        servings: 0,
        durationMinutes: 0,
        difficulty: 'easy',
        spiceLevel: 1,
        origin: '',
        isPublic: false,
      });

      expect(store.editorModel().title).toBe('Minimal');
      expect(store.editorModel().origin).toBe('Unknown');
      expect(store.editorModel().calories).toBe('');
      expect(store.editorModel().protein).toBe('');
      expect(store.editorIngredients().length).toBe(1);
      expect(store.editorIngredients()[0].ingredientName).toBe('');
    });

    it('should handle partial nutrition data', () => {
      store.populateFromExtraction({
        title: 'Partial Nutrition',
        ingredients: [{ ingredientName: 'salt', quantity: 1, unit: 'tsp' }],
        additionalInformation: [],
        instructionSteps: [],
        nutrition: { calories: 100 },
        servings: 2,
        durationMinutes: 10,
        difficulty: 'easy',
        spiceLevel: 1,
        origin: 'Unknown',
        isPublic: false,
      });

      expect(store.editorModel().calories).toBe('100');
      expect(store.editorModel().protein).toBe('');
      expect(store.editorModel().carbs).toBe('');
      expect(store.editorModel().fat).toBe('');
    });
  });
});
