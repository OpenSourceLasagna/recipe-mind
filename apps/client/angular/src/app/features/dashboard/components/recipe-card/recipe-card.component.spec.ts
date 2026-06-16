import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RecipeCardComponent } from './recipe-card.component';
import { RecipeResponse } from '../../models/recipe.model';

const mockRecipe: RecipeResponse = {
  id: '123',
  title: 'Test Recipe',
  additionalInformation: [],
  instructionSteps: [],
  nutrition: {},
  servings: 4,
  durationMinutes: 30,
  difficulty: 'easy',
  spiceLevel: 3,
  origin: 'Test',
  isPublic: true,
  ingredients: [],
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('RecipeCardComponent', () => {
  let component: RecipeCardComponent;
  let fixture: ComponentFixture<RecipeCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecipeCardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RecipeCardComponent);
    fixture.componentRef.setInput('recipe', mockRecipe);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit recipe id on click', () => {
    let emitted: string | undefined;
    component.cardClick.subscribe((id) => (emitted = id));
    component.onClick();
    expect(emitted).toBe('123');
  });
});
