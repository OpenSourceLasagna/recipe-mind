import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MarkdownModule } from 'ngx-markdown';
import { PanelChatMessage } from '../../models/chat-message.model';
import { RecipeDetailViewComponent } from '../../../dashboard/components/recipe-detail-view/recipe-detail-view.component';
import { RecipeCardComponent } from '../../../dashboard/components/recipe-card/recipe-card.component';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { ChatStore } from '../../chat.store';
import { RecipeFilterService } from '../../../dashboard/services/recipe-filter.service';

@Component({
  selector: 'app-chat-message',
  standalone: true,
  imports: [
    MarkdownModule,
    RecipeDetailViewComponent,
    RecipeCardComponent,
    HlmSkeletonImports,
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
                      <app-recipe-card [recipe]="recipe" />
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

  private readonly chatStore = inject(ChatStore);
  private readonly filterService = inject(RecipeFilterService);

  readonly isDesktopResultsMode = computed(
    () => this.chatStore.hasAiResults() && this.filterService.isDesktop(),
  );
}
