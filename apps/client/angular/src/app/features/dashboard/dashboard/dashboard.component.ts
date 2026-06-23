import { Component, effect, inject, PLATFORM_ID } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroAdjustmentsHorizontal } from '@ng-icons/heroicons/outline';
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
    HlmCardImports,
    HlmSkeletonImports,
    NgIcon,
  ],
  providers: [provideIcons({ heroAdjustmentsHorizontal })],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent {
  readonly #recipeList = inject(RecipeListService);
  readonly #router = inject(Router);
  readonly #route = inject(ActivatedRoute);
  readonly #platformId = inject(PLATFORM_ID);
  readonly filter = inject(RecipeFilterService);
  readonly chat = inject(ChatStore);
  readonly Error = Error;
  readonly recipes = this.#recipeList.recipes;
  readonly skeletonItems = Array(8);

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

  }

  openDetails(id: string): void {
    this.#router.navigate(['/dashboard', 'recipes', id]);
  }


}
