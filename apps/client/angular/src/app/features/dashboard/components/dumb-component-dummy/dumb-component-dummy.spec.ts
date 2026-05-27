import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DumbComponentDummy } from './dumb-component-dummy';

describe('DumbComponentDummy', () => {
  let component: DumbComponentDummy;
  let fixture: ComponentFixture<DumbComponentDummy>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DumbComponentDummy],
    }).compileComponents();

    fixture = TestBed.createComponent(DumbComponentDummy);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
