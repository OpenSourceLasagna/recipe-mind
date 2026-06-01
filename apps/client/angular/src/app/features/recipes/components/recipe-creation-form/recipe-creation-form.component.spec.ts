import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RecipeCreationFormComponent } from './recipe-creation-form.component';
import { CreateIngredientRequest } from '../../models/create-recipe.model';

describe('RecipeCreationFormComponent', () => {
  let component: RecipeCreationFormComponent;
  let fixture: ComponentFixture<RecipeCreationFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecipeCreationFormComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RecipeCreationFormComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render form fields', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('input#title')).toBeTruthy();
    expect(el.querySelector('input#origin')).toBeTruthy();
    expect(el.querySelector('textarea#instructions')).toBeTruthy();
    expect(el.textContent).toContain('Nutrition');
  });

  it('should be invalid initially', () => {
    expect(component.recipeForm().valid()).toBe(false);
  });

  it('should have empty ingredients initially', () => {
    expect(component.ingredients().length).toBe(1);
    expect(component.ingredients()[0].ingredientName).toBe('');
  });

  it('should have ingredients invalid with empty name', () => {
    expect(component.ingredientsValid().valid).toBe(false);
  });

  it('submit should not emit when form is invalid', () => {
    const spy = vi.spyOn(component.recipeSubmit, 'emit');
    component.submit(new Event('submit'));
    expect(spy).not.toHaveBeenCalled();
  });

  it('submit should emit when form and ingredients are valid', () => {
    vi.useFakeTimers();

    component.recipeForm.title().value.set('Test Recipe');
    component.recipeForm.instructionsText().value.set('Step one\nStep two');
    component.recipeForm.origin().value.set('Italy');
    component.ingredients.set([
      { ingredientName: 'Salt', quantity: 1, unit: 'tsp' },
      { ingredientName: 'Pepper', quantity: 0.5, unit: 'tsp' },
    ]);

    vi.advanceTimersByTime(1000);

    expect(component.recipeForm().valid()).toBe(true);
    expect(component.ingredientsValid().valid).toBe(true);

    const spy = vi.spyOn(component.recipeSubmit, 'emit');
    component.submit(new Event('submit'));

    expect(spy).toHaveBeenCalledTimes(1);
    const emitted = spy.mock.calls[0][0];
    expect(emitted.title).toBe('Test Recipe');
    expect(emitted.origin).toBe('Italy');
    expect(emitted.instructionSteps).toEqual(['Step one', 'Step two']);
    expect(emitted.ingredients).toHaveLength(2);

    vi.useRealTimers();
  });

  it('should split instructions by line', () => {
    vi.useFakeTimers();

    component.recipeForm.title().value.set('My Recipe');
    component.recipeForm.instructionsText().value.set('Chop onions\n Fry in oil\n Serve hot');
    component.ingredients.set([
      { ingredientName: 'Onion', quantity: 1, unit: '' },
      { ingredientName: 'Oil', quantity: 2, unit: 'tbsp' },
    ]);

    vi.advanceTimersByTime(1000);

    const spy = vi.spyOn(component.recipeSubmit, 'emit');
    component.submit(new Event('submit'));

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].instructionSteps).toEqual(['Chop onions', 'Fry in oil', 'Serve hot']);

    vi.useRealTimers();
  });

  it('should build nutrition from parsed fields', () => {
    vi.useFakeTimers();

    component.recipeForm.title().value.set('Healthy Dish');
    component.recipeForm.instructionsText().value.set('Mix ingredients');
    component.ingredients.set([
      { ingredientName: 'A', quantity: 1, unit: '' },
      { ingredientName: 'B', quantity: 1, unit: '' },
    ]);
    component.recipeForm.calories().value.set('250');
    component.recipeForm.protein().value.set('20');
    component.recipeForm.carbs().value.set('30');
    component.recipeForm.fat().value.set('10');

    vi.advanceTimersByTime(1000);

    const spy = vi.spyOn(component.recipeSubmit, 'emit');
    component.submit(new Event('submit'));

    expect(spy.mock.calls[0][0].nutrition).toEqual({
      calories: 250,
      protein: 20,
      carbs: 30,
      fat: 10,
    });

    vi.useRealTimers();
  });
});
