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

    it('should split instructions text by newlines and filter empty lines', () => {
      store.editorModel.set({
        ...store.editorModel(),
        title: 'Test',
        instructionsText: 'step 1\nstep 2\n\n  \nstep 3',
      });

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

    it('should call addUrlRecipe for link mode', () => {
      store.setActiveMethod('link');
      store.urlInput.set('https://example.com/recipe');

      store.submitCurrentMode().subscribe();

      const req = httpMock.expectOne((r) => r.url.includes('/url'));
      expect(req.request.method).toBe('POST');
      expect(req.request.body.url).toContain('example.com');
      req.flush({});
    });

    it('should call addTextRecipe for text mode', () => {
      store.setActiveMethod('text');
      store.rawTextInput.set('Some recipe text');

      store.submitCurrentMode().subscribe();

      const req = httpMock.expectOne((r) => r.url.includes('/text'));
      expect(req.request.method).toBe('POST');
      expect(req.request.body.text).toBe('Some recipe text');
      req.flush({});
    });
  });
});
