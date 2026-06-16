import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MarkdownModule } from 'ngx-markdown';
import { PanelChatMessage } from '../../models/chat-message.model';
import { RecipeDetailViewComponent } from '../../../dashboard/components/recipe-detail-view/recipe-detail-view.component';
import { RecipeCardComponent } from '../../../dashboard/components/recipe-card/recipe-card.component';

@Component({
  selector: 'app-chat-message',
  standalone: true,
  imports: [MarkdownModule, RecipeDetailViewComponent, RecipeCardComponent],
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
              @if (extra.recipeList ? $any(extra.recipeList) : null; as recipes) {
                @for (recipe of recipes; track recipe.id) {
                  <div class="recipe-card">
                    <h4>{{ recipe.title }}</h4>
                    <app-recipe-card [recipe]="recipe" />
                  </div>
                }
              }
              @if (extra.recipeDraft ? $any(extra.recipeDraft) : null; as draft) {
                <app-recipe-detail-view [recipe]="draft" />
              }
            }
          } @else {
            @if (message().additionalContent; as preview) {
              @if (preview.recipeList ? $any(preview.recipeList) : null; as recipes) {
                @for (recipe of recipes; track recipe?.id) {
                  {{ recipe?.title }}
                }
              }
              @if (preview.recipeDraft ? $any(preview.recipeDraft) : null; as draft) {
                {{ preview.recipeDraft }} {{ $any(preview.recipeDraft)?.title ?? 'no title' }}
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
}
