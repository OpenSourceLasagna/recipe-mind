import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreationMethodBoxComponent } from './creation-method-box.component';

describe('CreationMethodBoxComponent', () => {
  let component: CreationMethodBoxComponent;
  let fixture: ComponentFixture<CreationMethodBoxComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreationMethodBoxComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CreationMethodBoxComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
