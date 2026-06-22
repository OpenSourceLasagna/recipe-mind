import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroSparkles } from '@ng-icons/heroicons/outline';
import { MarkdownModule } from 'ngx-markdown';
import { HlmButton } from '@spartan-ng/helm/button';
import { PanelChatMessage } from '../../models/chat-message.model';
import { RecipeDetailViewComponent } from '../../../dashboard/components/recipe-detail-view/recipe-detail-view.component';
import { RecipeCardComponent } from '../../../dashboard/components/recipe-card/recipe-card.component';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { ChatStore } from '../../chat.store';
import { RecipeFilterService } from '../../../dashboard/services/recipe-filter.service';
import { RecipeMessageComponent } from '../recipe-message/recipe-message.component';
import { RecipeResponse } from '../../../dashboard/models/recipe.model';
import { RecipePatchRequest } from '../../../dashboard/models/recipe-edit.model';
import { RecipeCardDto, toRecipeCardDto } from '../../../dashboard/models/recipe-card.dto';

@Component({
  selector: 'app-chat-message',
  standalone: true,
  imports: [
    MarkdownModule,
    RecipeDetailViewComponent,
    RecipeCardComponent,
    HlmSkeletonImports,
    RecipeMessageComponent,
    NgIcon,
    HlmButton,
  ],
  providers: [provideIcons({ heroSparkles })],
  templateUrl: './chat-message.component.html',
  styleUrl: './chat-message.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatMessageComponent {
  readonly message = input.required<PanelChatMessage>();
  readonly isPending = input<boolean>(false);
  readonly isFocused = input<boolean>(false);

  readonly collapseClick = output<number>();
  readonly closeClick = output<number>();
  readonly editClick = output<number>();
  readonly saveClick = output<number>();
  readonly saveEditClick = output<{ messageId: number; patch: RecipePatchRequest }>();
  readonly saveAsCopyClick = output<{ messageId: number; modifiedRecipe: RecipeResponse }>();
  readonly dismissChangesClick = output<number>();
  readonly cancelEditClick = output<number>();
  readonly expandRecipe = output<RecipeResponse>();
  readonly highlightEnd = output<void>();
  readonly activateClick = output<number>();

  private readonly chatStore = inject(ChatStore);
  private readonly filterService = inject(RecipeFilterService);
  private readonly router = inject(Router);

  readonly isDesktopResultsMode = computed(
    () => this.chatStore.hasAiResults() && this.filterService.isDesktop(),
  );

  readonly isMobile = computed(() => this.filterService.isMobile());

  readonly isDesktop = computed(() => this.filterService.isDesktop());

  readonly isActiveRecipeDraft = computed(() => {
    const draft = this.message().additionalContent?.recipeDraft;
    if (!draft) return false;
    return this.chatStore.activeRecipeId() === draft.id;
  });

  readonly draftChangedCount = computed(() => {
    return this.message().additionalContent?.changedFields?.length ?? 0;
  });

  readonly messageClasses = computed(() => {
    const classes = ['transition-all duration-500'];
    if (this.isFocused()) {
      classes.push('ring-2 ring-primary ring-offset-2 ring-offset-background rounded-lg');
      classes.push('animate-highlight-pulse');
    }
    return classes.join(' ');
  });

  onHighlightAnimationEnd(): void {
    if (this.isFocused()) {
      this.highlightEnd.emit();
    }
  }

  handleRecipeCardClick(recipeId: string): void {
    if (this.filterService.isDesktop()) {
      this.router.navigate(['/dashboard', 'recipes', recipeId]);
    } else {
      const recipe = this.getRecipeById(recipeId);
      if (recipe) {
        this.expandRecipe.emit(recipe);
      }
    }
  }

  mapRecipeToCardDto(recipe: RecipeResponse): RecipeCardDto {
    return toRecipeCardDto(recipe);
  }

  private getRecipeById(recipeId: string): RecipeResponse | null {
    const additionalContent = this.message().additionalContent;
    if (!additionalContent) return null;

    const recipeList = additionalContent.recipeList as RecipeResponse[] | undefined;
    return recipeList?.find((r) => r.id === recipeId) ?? null;
  }
}
