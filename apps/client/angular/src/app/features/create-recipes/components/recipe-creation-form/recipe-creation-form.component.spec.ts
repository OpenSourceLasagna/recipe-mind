import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RecipeCreationFormComponent } from './recipe-creation-form.component';
import { RecipeCreationStore } from '../../services/recipe-creation.store';

describe('RecipeCreationFormComponent', () => {
  let component: RecipeCreationFormComponent;
  let fixture: ComponentFixture<RecipeCreationFormComponent>;
  let store: RecipeCreationStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecipeCreationFormComponent],
      providers: [RecipeCreationStore],
    }).compileComponents();

    store = TestBed.inject(RecipeCreationStore);
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

  it('should reflect store editor form state', () => {
    expect(store.editorForm().valid()).toBe(false);
    expect(store.editorForm.title().value()).toBe('');
  });

  it('should reflect store ingredient state', () => {
    expect(store.editorIngredients().length).toBe(1);
    expect(store.editorIngredients()[0].ingredientName).toBe('');
  });

  it('should have ingredients invalid with empty name', () => {
    expect(store.ingredientsValid().valid).toBe(false);
  });

  it('should render recipe-ingredients-edit component', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-recipe-ingredients-edit')).toBeTruthy();
  });
});
