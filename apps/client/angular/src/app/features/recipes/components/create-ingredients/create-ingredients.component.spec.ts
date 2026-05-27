import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateIngredientsComponent } from './create-ingredients.component';

describe('CreateIngredientsComponent', () => {
  let component: CreateIngredientsComponent;
  let fixture: ComponentFixture<CreateIngredientsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateIngredientsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CreateIngredientsComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
