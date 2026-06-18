import { Component, computed, effect, inject, PLATFORM_ID, OnInit, untracked } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroAdjustmentsHorizontal } from '@ng-icons/heroicons/outline';
import { BreakpointObserver } from '@angular/cdk/layout';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { ActivatedRoute, Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { RecipeListService } from '../services/recipe-list.service';
import { RecipeFilterService } from '../services/recipe-filter.service';
import { RecipeCardComponent } from '../components/recipe-card/recipe-card.component';
import { RecipeFilterSheetComponent } from '../components/filter-sheet/filter-sheet.component';
import { FilterBarComponent } from '../components/filter-bar/filter-bar.component';
import { RecipeSearchBarComponent } from '../components/recipe-search-bar/recipe-search-bar.component';
import { ChatButtonComponent } from '../../chat/components/chat-button/chat-button.component';
import { ChatPanelComponent } from '../../chat/components/chat-panel/chat-panel.component';
import { ChatStore } from '../../chat/chat.store';
import { AiResultsBannerComponent } from '../components/ai-results-banner/ai-results-banner.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    RecipeCardComponent,
    RecipeFilterSheetComponent,
    FilterBarComponent,
    RecipeSearchBarComponent,
    ChatButtonComponent,
    ChatPanelComponent,
    AiResultsBannerComponent,
    HlmCardImports,
    HlmSkeletonImports,
    NgIcon,
  ],
  providers: [provideIcons({ heroAdjustmentsHorizontal })],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit {
  readonly #breakpoint = inject(BreakpointObserver);
  readonly #recipeList = inject(RecipeListService);
  readonly #router = inject(Router);
  readonly #route = inject(ActivatedRoute);
  readonly #platformId = inject(PLATFORM_ID);
  readonly filter = inject(RecipeFilterService);
  readonly chat = inject(ChatStore);

  readonly Error = Error;
  readonly recipes = this.#recipeList.recipes;
  readonly skeletonItems = Array(8);

  readonly isDesktopResultsMode = computed(
    () => this.chat.hasAiResults() && this.filter.isDesktop(),
  );

  readonly displayRecipes = computed(() => {
    if (this.isDesktopResultsMode()) {
      return this.chat.aiResults();
    }
    return this.recipes.hasValue() ? this.recipes.value().items : null;
  });

  #wasDesktop = false;

  constructor() {
    const defaults: Record<string, string> = {
      sortBy: 'created_at',
      sortOrder: 'desc',
      page: '1',
      pageSize: '20',
    };

    effect((onCleanup) => {
      if (!isPlatformBrowser(this.#platformId)) return;
      this.filter.toHttpParams();
      const timer = setTimeout(() => {
        const httpParams = this.filter.toHttpParams();
        const queryParams: Record<string, string> = {};
        for (const key of httpParams.keys()) {
          const value = httpParams.get(key)!;
          if (defaults[key] && defaults[key] === value) continue;
          queryParams[key] = value;
        }
        this.#router.navigate([], {
          relativeTo: this.#route,
          queryParams,
          replaceUrl: true,
        });
      }, 200);
      onCleanup(() => clearTimeout(timer));
    });

    effect(() => {
      const isDesktop = this.filter.isDesktop();
      const wasDesktop = this.#wasDesktop;
      untracked(() => {
        this.#wasDesktop = isDesktop;
      });

      if (!wasDesktop && isDesktop) {
        untracked(() => this.#handleMobileToDesktopTransition());
      } else if (wasDesktop && !isDesktop) {
        untracked(() => this.#handleDesktopToMobileTransition());
      }
    });
  }

  ngOnInit(): void {
    this.#breakpoint.observe('(min-width: 1024px)').subscribe((bp) => {
      this.filter.isDesktop.set(bp.matches);
    });
  }

  openDetails(id: string): void {
    this.#router.navigate(['/dashboard', 'recipes', id]);
  }

  dismissAiResults(): void {
    this.chat.clearAiResults();
  }

  async #handleMobileToDesktopTransition(): Promise<void> {
    if (this.chat.hasAiResults()) return;

    const activeRecipeId = this.chat.activeRecipeId();
    const recipeCards = this.chat.extractRecipeCardDtos();
    if (recipeCards.length === 0) return;

    this.chat.setAiResults(recipeCards);

    if (activeRecipeId) {
      this.#router.navigate(['/dashboard', 'recipes', activeRecipeId]);
    }
  }

  #handleDesktopToMobileTransition(): void {
    const firstRecipeId = this.chat.findFirstRecipeMessageId();
    if (firstRecipeId !== null) {
      this.chat.activateRecipeMessage(firstRecipeId);
      this.chat.focusRecipeMessage(firstRecipeId);
      this.chat.open();
    }
  }
}
