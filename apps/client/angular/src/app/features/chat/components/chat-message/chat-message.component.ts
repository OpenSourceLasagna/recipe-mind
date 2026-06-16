import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { Router } from '@angular/router';
import { MarkdownModule } from 'ngx-markdown';
import { PanelChatMessage } from '../../models/chat-message.model';
import { RecipeDetailViewComponent } from '../../../dashboard/components/recipe-detail-view/recipe-detail-view.component';
import { RecipeCardComponent } from '../../../dashboard/components/recipe-card/recipe-card.component';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { ChatStore } from '../../chat.store';
import { RecipeFilterService } from '../../../dashboard/services/recipe-filter.service';
import { RecipeMessageComponent } from '../recipe-message/recipe-message.component';
import { RecipeResponse } from '../../../dashboard/models/recipe.model';
import { RecipePatchRequest } from '../../../dashboard/models/recipe-edit.model';

@Component({
  selector: 'app-chat-message',
  standalone: true,
  imports: [
    MarkdownModule,
    RecipeDetailViewComponent,
    RecipeCardComponent,
    HlmSkeletonImports,
    RecipeMessageComponent,
  ],
  template: `
    @if (message().role === 'user') {
      <div class="flex justify-end">
        <div
          class="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-primary-foreground text-sm"
        >
          {{ message().content }}
        </div>
      </div>
    } @else if (message().role === 'recipe' && message().recipeContext) {
      <app-recipe-message
        [recipeContext]="message().recipeContext!"
        (collapseClick)="collapseClick.emit(message().id)"
        (closeClick)="closeClick.emit(message().id)"
        (editClick)="editClick.emit(message().id)"
        (saveClick)="saveClick.emit(message().id)"
        (saveEditClick)="saveEditClick.emit({ messageId: message().id, patch: $event })"
        (cancelEditClick)="cancelEditClick.emit(message().id)"
      />
    } @else {
      <div class="flex justify-start">
        <div class="max-w-full prose prose-sm dark:prose-invert text-foreground">
          <markdown [data]="message().content" />
          @if (!isPending()) {
            @if (message().additionalContent; as extra) {
              @if (!isDesktopResultsMode()) {
                @if (extra.recipeList ? $any(extra.recipeList) : null; as recipes) {
                  @for (recipe of recipes; track recipe.id) {
                    <div class="recipe-card">
                      <h4>{{ recipe.title }}</h4>
                      <app-recipe-card
                        [recipe]="recipe"
                        (cardClick)="handleRecipeCardClick(recipe.id)"
                      />
                    </div>
                  }
                }
              } @else {
                @if (extra.recipeList; as recipes) {
                  <p class="text-sm text-muted-foreground not-prose">
                    Found {{ recipes.length }} recipe{{ recipes.length === 1 ? '' : 's' }}
                  </p>
                }
              }
              @if (extra.recipeDraft ? $any(extra.recipeDraft) : null; as draft) {
                <app-recipe-detail-view [recipe]="draft" />
              }
            }
          } @else {
            @if (message().additionalContent; as preview) {
              @if (preview.recipeList ? $any(preview.recipeList) : null; as recipes) {
                <p class="text-sm text-muted-foreground not-prose">
                  Found {{ recipes.length }} recipe{{ recipes.length === 1 ? '' : 's' }}
                </p>
              }
              @if (preview.recipeDraft) {
                <div class="space-y-2 not-prose">
                  <div hlmSkeleton class="h-6 w-3/4"></div>
                  <div hlmSkeleton class="h-4 w-full"></div>
                  <div hlmSkeleton class="h-4 w-5/6"></div>
                </div>
              }
            }
          }
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatMessageComponent {
  readonly message = input.required<PanelChatMessage>();
  readonly isPending = input<boolean>(false);

  readonly collapseClick = output<number>();
  readonly closeClick = output<number>();
  readonly editClick = output<number>();
  readonly saveClick = output<number>();
  readonly saveEditClick = output<{ messageId: number; patch: RecipePatchRequest }>();
  readonly cancelEditClick = output<number>();
  readonly expandRecipe = output<RecipeResponse>();

  private readonly chatStore = inject(ChatStore);
  private readonly filterService = inject(RecipeFilterService);
  private readonly router = inject(Router);

  readonly isDesktopResultsMode = computed(
    () => this.chatStore.hasAiResults() && this.filterService.isDesktop(),
  );

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

  private getRecipeById(recipeId: string): RecipeResponse | null {
    const additionalContent = this.message().additionalContent;
    if (!additionalContent) return null;

    const recipeList = additionalContent.recipeList as RecipeResponse[] | undefined;
    return recipeList?.find((r) => r.id === recipeId) ?? null;
  }
}
