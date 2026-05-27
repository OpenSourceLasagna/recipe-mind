import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PasswordInputComponent } from './password-input.component';

describe('PasswordInputComponent', () => {
  let component: PasswordInputComponent;
  let fixture: ComponentFixture<PasswordInputComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PasswordInputComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PasswordInputComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
