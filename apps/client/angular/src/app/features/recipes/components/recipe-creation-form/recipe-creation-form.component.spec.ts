import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RecipeCreationFormComponent } from './recipe-creation-form.component';

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
});
