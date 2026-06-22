import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { RecipeDetailViewComponent } from './recipe-detail-view.component';
import { RecipeResponse } from '../../models/recipe.model';
import { RecipeIngredientResponse } from '../../models/ingredient.model';

function makeRecipe(overrides: Partial<RecipeResponse> = {}): RecipeResponse {
  return {
    id: 'r1',
    title: 'Test Recipe',
    additionalInformation: ['Info 1'],
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

describe('RecipeDetailViewComponent', () => {
  let fixture: ComponentFixture<RecipeDetailViewComponent>;
  let component: RecipeDetailViewComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecipeDetailViewComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RecipeDetailViewComponent);
    component = fixture.componentInstance;
  });

  function setRecipeInputs(
    recipe: RecipeResponse,
    modifiedRecipe: RecipeResponse | null = null,
    overrides: Partial<{
      isOwner: boolean;
      isEditing: boolean;
      viewMode: 'original' | 'modified';
      autoSwitchToChanges: boolean;
      variant: 'page' | 'inline';
    }> = {},
  ) {
    fixture.componentRef.setInput('recipe', recipe);
    fixture.componentRef.setInput('modifiedRecipe', modifiedRecipe);
    fixture.componentRef.setInput('isOwner', overrides.isOwner ?? false);
    fixture.componentRef.setInput('isEditing', overrides.isEditing ?? false);
    fixture.componentRef.setInput('autoSwitchToChanges', overrides.autoSwitchToChanges ?? false);
    fixture.componentRef.setInput('variant', overrides.variant ?? 'page');
    if (overrides.viewMode) {
      component.viewMode.set(overrides.viewMode);
    }
    fixture.detectChanges();
  }

  describe('computed signals', () => {
    it('should report hasModified as false when no modified recipe', () => {
      setRecipeInputs(makeRecipe(), null);
      expect(component.hasModified()).toBe(false);
    });

    it('should report hasModified as true when modified recipe is set', () => {
      setRecipeInputs(makeRecipe(), makeRecipe({ title: 'Changed' }));
      expect(component.hasModified()).toBe(true);
    });

    it('should report showVersionToggle as false when no modified recipe', () => {
      setRecipeInputs(makeRecipe(), null);
      expect(component.showVersionToggle()).toBe(false);
    });

    it('should report showVersionToggle as false when modified but no changes', () => {
      const recipe = makeRecipe();
      setRecipeInputs(recipe, recipe);
      expect(component.showVersionToggle()).toBe(false);
    });

    it('should report showVersionToggle as true when real changes exist', () => {
      setRecipeInputs(makeRecipe(), makeRecipe({ title: 'Changed Title' }));
      expect(component.showVersionToggle()).toBe(true);
    });

    it('should compute changedFields correctly for modified recipe', () => {
      setRecipeInputs(makeRecipe(), makeRecipe({ title: 'New', servings: 6 }));
      const fields = component.changedFields();
      expect(fields.has('title')).toBe(true);
      expect(fields.has('servings')).toBe(true);
      expect(fields.has('difficulty')).toBe(false);
    });

    it('should return recipe from activeRecipe (always original)', () => {
      const recipe = makeRecipe();
      setRecipeInputs(recipe, makeRecipe({ title: 'Changed' }));
      component.viewMode.set('modified');
      fixture.detectChanges();
      expect(component.activeRecipe().title).toBe('Test Recipe');
    });
  });

  describe('displayIngredients diff mode', () => {
    it('should return unchanged items in original mode', () => {
      setRecipeInputs(makeRecipe(), null);
      const items = component.displayIngredients();
      expect(items.every((i) => i.status === 'unchanged')).toBe(true);
    });

    it('should detect added ingredient in modified mode', () => {
      const orig = makeRecipe();
      const mod = makeRecipe({
        ingredients: [
          ...orig.ingredients,
          { id: 'i-3', ingredientName: 'Sugar', quantity: 1, unit: 'cup', categoryId: null },
        ],
      });
      setRecipeInputs(orig, mod);
      component.viewMode.set('modified');
      fixture.detectChanges();
      const items = component.displayIngredients();
      expect(items.some((i) => i.status === 'added')).toBe(true);
    });

    it('should detect quantity change in modified mode', () => {
      const orig = makeRecipe();
      const mod = makeRecipe({
        ingredients: [{ ...orig.ingredients[0], quantity: 5 }, orig.ingredients[1]],
      });
      setRecipeInputs(orig, mod);
      component.viewMode.set('modified');
      fixture.detectChanges();
      const items = component.displayIngredients();
      expect(items[0].status).toBe('modified');
    });
  });

  describe('displayInstructions diff mode', () => {
    it('should detect added step', () => {
      setRecipeInputs(
        makeRecipe(),
        makeRecipe({ instructionSteps: ['Step 1', 'Step 2', 'Step 3'] }),
      );
      component.viewMode.set('modified');
      fixture.detectChanges();
      const steps = component.displayInstructions();
      expect(steps).toHaveLength(3);
      expect(steps[2].status).toBe('added');
    });
  });

  describe('version toggle', () => {
    it('should emit saveAsCopyClick with modified recipe', () => {
      const mod = makeRecipe({ title: 'Forked Recipe' });
      setRecipeInputs(makeRecipe(), mod);
      const spy = vi.fn();
      component.saveAsCopyClick.subscribe(spy);
      component.onSaveAsCopy();
      expect(spy).toHaveBeenCalledWith(mod);
    });

    it('should emit dismissChangesClick and reset viewMode', () => {
      setRecipeInputs(makeRecipe(), makeRecipe({ title: 'Changed' }));
      component.viewMode.set('modified');
      const spy = vi.fn();
      component.dismissChangesClick.subscribe(spy);
      component.onDismissChanges();
      expect(spy).toHaveBeenCalled();
      expect(component.viewMode()).toBe('original');
    });

    it('should not emit saveAsCopyClick when no modified recipe', () => {
      setRecipeInputs(makeRecipe(), null);
      const spy = vi.fn();
      component.saveAsCopyClick.subscribe(spy);
      component.onSaveAsCopy();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('template rendering', () => {
    it('should render the recipe title', () => {
      setRecipeInputs(makeRecipe());
      const title = fixture.nativeElement.querySelector('h1');
      expect(title?.textContent).toContain('Test Recipe');
    });

    it('should render the back button by default', () => {
      setRecipeInputs(makeRecipe());
      const backBtn = fixture.nativeElement.querySelector('[aria-label="Back"]');
      expect(backBtn).toBeNull();
      const backEl = fixture.nativeElement.querySelector('button');
      const arrowIcon = fixture.nativeElement.querySelector('ng-icon[name="heroArrowLeft"]');
      expect(arrowIcon).not.toBeNull();
    });

    it('should hide back button when variant is inline', () => {
      fixture.componentRef.setInput('variant', 'inline');
      fixture.componentRef.setInput('recipe', makeRecipe());
      fixture.detectChanges();
      const arrowIcon = fixture.nativeElement.querySelector('ng-icon[name="heroArrowLeft"]');
      expect(arrowIcon).toBeNull();
    });

    it('should show version toggle when changes exist', () => {
      setRecipeInputs(makeRecipe(), makeRecipe({ title: 'Changed' }));
      const toggle = fixture.nativeElement.querySelector('[aria-label="Recipe version"]');
      expect(toggle).not.toBeNull();
    });

    it('should show save/dismiss footer in changes mode', () => {
      setRecipeInputs(makeRecipe(), makeRecipe({ title: 'Changed' }));
      component.viewMode.set('modified');
      fixture.detectChanges();
      const saveBtn = fixture.nativeElement.querySelector('button');
      expect(fixture.nativeElement.textContent).toContain('Save as Copy');
      expect(fixture.nativeElement.textContent).toContain('Dismiss Changes');
    });

    it('should not show save/dismiss footer in original mode', () => {
      setRecipeInputs(makeRecipe(), makeRecipe({ title: 'Changed' }));
      component.viewMode.set('original');
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).not.toContain('Save as Copy');
    });
  });
});
