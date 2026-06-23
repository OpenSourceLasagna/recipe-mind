import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroSparkles } from '@ng-icons/heroicons/outline';
import { MarkdownModule } from 'ngx-markdown';
import { PanelChatMessage } from '../../models/chat-message.model';
import { RecipeCardComponent } from '../../../dashboard/components/recipe-card/recipe-card.component';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { RecipeMessageComponent } from '../recipe-message/recipe-message.component';
import { RecipeResponse } from '../../../dashboard/models/recipe.model';
import { RecipePatchRequest } from '../../../dashboard/models/recipe-edit.model';
import { RecipeCardDto, toRecipeCardDto } from '../../../dashboard/models/recipe-card.dto';

@Component({
  selector: 'app-chat-message',
  standalone: true,
  imports: [
    MarkdownModule,
    RecipeCardComponent,
    HlmSkeletonImports,
    RecipeMessageComponent,
    NgIcon,
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
  readonly fullscreenClick = output<number>();

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
    const recipe = this.getRecipeById(recipeId);
    if (recipe) {
      this.expandRecipe.emit(recipe);
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
