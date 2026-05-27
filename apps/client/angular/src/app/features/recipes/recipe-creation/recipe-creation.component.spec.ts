import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RecipeCreationComponent } from './recipe-creation.component';

describe('RecipeCreationComponent', () => {
  let component: RecipeCreationComponent;
  let fixture: ComponentFixture<RecipeCreationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecipeCreationComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RecipeCreationComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
