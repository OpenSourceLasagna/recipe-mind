import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateIngredientsComponent } from './create-ingredients.component';
import { CreateIngredientRequest } from '../../models/create-recipe.model';

describe('CreateIngredientsComponent', () => {
  let component: CreateIngredientsComponent;
  let fixture: ComponentFixture<CreateIngredientsComponent>;

  const defaultIngredient: CreateIngredientRequest = { ingredientName: 'Test', quantity: 1, unit: 'g' };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateIngredientsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CreateIngredientsComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('ingredients', [defaultIngredient]);
    fixture.componentRef.setInput('touched', false);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should add ingredient when current row is valid', () => {
    const initial = component.ingredients().length;
    component.addIngredient();
    expect(component.ingredients().length).toBe(initial + 1);
  });

  it('should remove ingredient by index', () => {
    component.removeIngredient(0);
    expect(component.ingredients().length).toBe(0);
  });

  it('should mark touched on add', () => {
    expect(component.touched()).toBe(false);
    component.addIngredient();
    expect(component.touched()).toBe(true);
  });

  it('should update ingredient field', () => {
    component.updateField(0, 'ingredientName', 'Updated');
    expect(component.ingredients()[0].ingredientName).toBe('Updated');
  });
});
