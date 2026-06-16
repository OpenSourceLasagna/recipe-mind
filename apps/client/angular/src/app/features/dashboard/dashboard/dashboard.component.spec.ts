import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { BreakpointObserver } from '@angular/cdk/layout';
import { DashboardComponent } from './dashboard.component';
import { RecipeFilterService } from '../services/recipe-filter.service';
import { RecipeListService } from '../services/recipe-list.service';
import { ChatStore } from '../../chat/chat.store';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let chatStore: ChatStore;
  let filterService: RecipeFilterService;

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
    chatStore = TestBed.inject(ChatStore);
    filterService = TestBed.inject(RecipeFilterService);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('isDesktopResultsMode', () => {
    it('should be false when no ai results', () => {
      filterService.isDesktop.set(true);
      expect(component.isDesktopResultsMode()).toBe(false);
    });

    it('should be true when ai results exist and is desktop', () => {
      chatStore.setAiResults([
        { id: '1', title: 'Pasta', difficulty: 'easy', spice_level: 1, durationMinutes: 30, servings: 4 },
      ]);
      filterService.isDesktop.set(true);
      expect(component.isDesktopResultsMode()).toBe(true);
    });

    it('should be false when ai results exist but is mobile', () => {
      chatStore.setAiResults([
        { id: '1', title: 'Pasta', difficulty: 'easy', spice_level: 1, durationMinutes: 30, servings: 4 },
      ]);
      filterService.isDesktop.set(false);
      expect(component.isDesktopResultsMode()).toBe(false);
    });
  });

  describe('displayRecipes', () => {
    it('should return ai results when in desktop results mode', () => {
      const aiRecipes = [
        { id: '1', title: 'AI Pasta', difficulty: 'easy' as const, spice_level: 1, durationMinutes: 30, servings: 4 },
      ];
      chatStore.setAiResults(aiRecipes);
      filterService.isDesktop.set(true);

      expect(component.displayRecipes()).toEqual(aiRecipes);
    });

    it('should return null when not in results mode and recipes not loaded', () => {
      filterService.isDesktop.set(true);
      expect(component.displayRecipes()).toBeNull();
    });
  });

  describe('dismissAiResults', () => {
    it('should clear ai results from store', () => {
      chatStore.setAiResults([
        { id: '1', title: 'Pasta', difficulty: 'easy', spice_level: 1, durationMinutes: 30, servings: 4 },
      ]);
      expect(chatStore.hasAiResults()).toBe(true);

      component.dismissAiResults();

      expect(chatStore.hasAiResults()).toBe(false);
      expect(chatStore.aiResults()).toBeNull();
    });
  });
});
