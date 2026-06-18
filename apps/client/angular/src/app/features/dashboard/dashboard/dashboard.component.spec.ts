import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { BreakpointObserver } from '@angular/cdk/layout';
import { signal } from '@angular/core';
import { DashboardComponent } from './dashboard.component';
import { RecipeFilterService } from '../services/recipe-filter.service';
import { RecipeListService } from '../services/recipe-list.service';
import { ChatStore } from '../../chat/chat.store';
import { MarkdownService, provideMarkdown } from 'ngx-markdown';
import { ChatService } from '../../chat/chat.service';
import { RecipeDetailService } from '../services/recipe-detail.service';

const testRoutes = [
  { path: 'dashboard/explore', component: {} as any },
  { path: 'dashboard/recipes/:id', component: {} as any },
];

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

  const mockChatService = {
    stream: { value: signal(null) },
    sendMessage: vi.fn(),
  };

  const mockRecipeDetailService = {
    recipe: {
      value: () => null,
      isLoading: () => false,
      error: () => null,
    },
    setRecipeId: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter(testRoutes),
        provideMarkdown(),
        RecipeFilterService,
        { provide: RecipeListService, useValue: mockRecipeListService },
        { provide: BreakpointObserver, useValue: mockBreakpointObserver },
        { provide: ChatService, useValue: mockChatService },
        { provide: RecipeDetailService, useValue: mockRecipeDetailService },
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
        {
          id: '1',
          title: 'Pasta',
          difficulty: 'easy',
          spice_level: 1,
          durationMinutes: 30,
          servings: 4,
        },
      ]);
      filterService.isDesktop.set(true);
      expect(component.isDesktopResultsMode()).toBe(true);
    });

    it('should be false when ai results exist but is mobile', () => {
      chatStore.setAiResults([
        {
          id: '1',
          title: 'Pasta',
          difficulty: 'easy',
          spice_level: 1,
          durationMinutes: 30,
          servings: 4,
        },
      ]);
      filterService.isDesktop.set(false);
      expect(component.isDesktopResultsMode()).toBe(false);
    });
  });

  describe('displayRecipes', () => {
    it('should return ai results when in desktop results mode', () => {
      const aiRecipes = [
        {
          id: '1',
          title: 'AI Pasta',
          difficulty: 'easy' as const,
          spice_level: 1,
          durationMinutes: 30,
          servings: 4,
        },
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
        {
          id: '1',
          title: 'Pasta',
          difficulty: 'easy',
          spice_level: 1,
          durationMinutes: 30,
          servings: 4,
        },
      ]);
      expect(chatStore.hasAiResults()).toBe(true);

      component.dismissAiResults();

      expect(chatStore.hasAiResults()).toBe(false);
      expect(chatStore.aiResults()).toBeNull();
    });
  });

  describe('mobile to desktop transition', () => {
    it('should preserve recipe messages and navigate to active recipe', async () => {
      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      filterService.isDesktop.set(false);
      await fixture.whenStable();

      const recipe = {
        id: 'r1',
        title: 'Pasta',
        difficulty: 'easy',
        spiceLevel: 1,
        durationMinutes: 30,
        servings: 4,
      } as any;
      chatStore.expandRecipe(recipe);

      expect(chatStore.isRecipeExpanded('r1')).toBe(true);

      filterService.isDesktop.set(true);
      await fixture.whenStable();

      expect(chatStore.isRecipeExpanded('r1')).toBe(true);
      expect(chatStore.hasAiResults()).toBe(true);
      expect(chatStore.aiResults()![0].id).toBe('r1');
      expect(navigateSpy).toHaveBeenCalledWith(['/dashboard', 'recipes', 'r1']);
    });

    it('should navigate to active recipe when multiple are expanded', async () => {
      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      filterService.isDesktop.set(false);
      await fixture.whenStable();

      const recipe1 = {
        id: 'r1',
        title: 'Pasta',
        difficulty: 'easy',
        spiceLevel: 1,
        durationMinutes: 30,
        servings: 4,
      } as any;
      const recipe2 = {
        id: 'r2',
        title: 'Pizza',
        difficulty: 'medium',
        spiceLevel: 2,
        durationMinutes: 45,
        servings: 2,
      } as any;
      chatStore.expandRecipe(recipe1);
      chatStore.expandRecipe(recipe2);

      filterService.isDesktop.set(true);
      await fixture.whenStable();

      expect(chatStore.aiResults()!.length).toBe(2);
      expect(navigateSpy).toHaveBeenCalledWith(['/dashboard', 'recipes', 'r2']);
    });

    it('should do nothing if no recipe messages in chat', async () => {
      filterService.isDesktop.set(false);
      await fixture.whenStable();

      filterService.isDesktop.set(true);
      await fixture.whenStable();

      expect(chatStore.hasAiResults()).toBe(false);
    });

    it('should not re-trigger transition if aiResults already set', async () => {
      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      filterService.isDesktop.set(false);
      await fixture.whenStable();

      const recipe = {
        id: 'r1',
        title: 'Pasta',
        difficulty: 'easy',
        spiceLevel: 1,
        durationMinutes: 30,
        servings: 4,
        additionalInformation: [],
        instructionSteps: [],
        nutrition: {},
        origin: '',
        isPublic: false,
        ingredients: [],
        createdAt: '',
        updatedAt: '',
      } as any;
      chatStore.expandRecipe(recipe);

      filterService.isDesktop.set(true);
      await fixture.whenStable();

      expect(navigateSpy).toHaveBeenCalledTimes(1);
      expect(chatStore.hasAiResults()).toBe(true);

      filterService.isDesktop.set(false);
      await fixture.whenStable();

      filterService.isDesktop.set(true);
      await fixture.whenStable();

      expect(navigateSpy).toHaveBeenCalledTimes(1);
    });

    it('should navigate to the currently active recipe, not the most recently expanded', async () => {
      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      filterService.isDesktop.set(false);
      await fixture.whenStable();

      const recipe1 = {
        id: 'r1',
        title: 'Pasta',
        difficulty: 'easy',
        spiceLevel: 1,
        durationMinutes: 30,
        servings: 4,
      } as any;
      const recipe2 = {
        id: 'r2',
        title: 'Pizza',
        difficulty: 'medium',
        spiceLevel: 2,
        durationMinutes: 45,
        servings: 2,
      } as any;
      chatStore.expandRecipe(recipe1);
      chatStore.expandRecipe(recipe2);

      const msg1Id = chatStore.messages()[0].id;
      chatStore.activateRecipeMessage(msg1Id);

      filterService.isDesktop.set(true);
      await fixture.whenStable();

      expect(navigateSpy).toHaveBeenCalledWith(['/dashboard', 'recipes', 'r1']);
    });
  });

  describe('desktop to mobile transition', () => {
    it('should preserve aiResults when transitioning to mobile (not cleared)', async () => {
      chatStore.setAiResults([
        {
          id: 'r1',
          title: 'Pasta',
          difficulty: 'easy',
          spice_level: 1,
          durationMinutes: 30,
          servings: 4,
        },
      ]);
      filterService.isDesktop.set(true);
      await fixture.whenStable();

      filterService.isDesktop.set(false);
      await fixture.whenStable();

      expect(chatStore.hasAiResults()).toBe(true);
      expect(chatStore.aiResults()![0].id).toBe('r1');
    });

    it('should activate first recipe message and open chat when transitioning to mobile', async () => {
      filterService.isDesktop.set(false);
      await fixture.whenStable();

      const recipe = {
        id: 'r1',
        title: 'Pasta',
        difficulty: 'easy',
        spiceLevel: 1,
        durationMinutes: 30,
        servings: 4,
        additionalInformation: [],
        instructionSteps: [],
        nutrition: {},
        origin: '',
        isPublic: false,
        ingredients: [],
        createdAt: '',
        updatedAt: '',
      } as any;
      chatStore.expandRecipe(recipe);

      filterService.isDesktop.set(true);
      await fixture.whenStable();

      filterService.isDesktop.set(false);
      await fixture.whenStable();

      expect(chatStore.messages()[0].recipeContext!.isActive).toBe(true);
      expect(chatStore.isOpen()).toBe(true);
    });

    it('should do nothing if no recipe messages exist', async () => {
      filterService.isDesktop.set(true);
      await fixture.whenStable();
      expect(chatStore.isOpen()).toBe(false);

      filterService.isDesktop.set(false);
      await fixture.whenStable();

      expect(chatStore.isOpen()).toBe(false);
    });

    it('should focus-scroll to the activated recipe message', async () => {
      filterService.isDesktop.set(false);
      await fixture.whenStable();

      const recipe = {
        id: 'r1',
        title: 'Pasta',
        difficulty: 'easy',
        spiceLevel: 1,
        durationMinutes: 30,
        servings: 4,
        additionalInformation: [],
        instructionSteps: [],
        nutrition: {},
        origin: '',
        isPublic: false,
        ingredients: [],
        createdAt: '',
        updatedAt: '',
      } as any;
      chatStore.expandRecipe(recipe);

      filterService.isDesktop.set(true);
      await fixture.whenStable();

      filterService.isDesktop.set(false);
      await fixture.whenStable();

      const firstRecipeId = chatStore.findFirstRecipeMessageId();
      expect(chatStore.focusedMessageId()).toBe(firstRecipeId);
    });
  });
});
