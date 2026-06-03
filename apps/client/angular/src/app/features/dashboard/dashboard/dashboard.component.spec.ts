import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { BreakpointObserver } from '@angular/cdk/layout';
import { DashboardComponent } from './dashboard.component';
import { RecipeFilterService } from '../services/recipe-filter.service';
import { RecipeListService } from '../services/recipe-list.service';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;

  const mockBreakpointObserver = {
    observe: vi.fn(() => of({ matches: true, breakpoints: {} })),
  };

  const mockRecipeListService = {
    recipes: {
      isLoading: () => false,
      error: () => null,
      hasValue: () => false,
      value: () => ({ items: [], total: 0, page: 1, page_size: 20, total_pages: 0 }),
      reload: vi.fn(),
    },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        RecipeFilterService,
        { provide: RecipeListService, useValue: mockRecipeListService },
        { provide: BreakpointObserver, useValue: mockBreakpointObserver },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});