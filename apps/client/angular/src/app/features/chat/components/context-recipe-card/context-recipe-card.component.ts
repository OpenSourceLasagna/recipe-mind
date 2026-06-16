import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroEye, heroEyeSlash, heroSparkles } from '@ng-icons/heroicons/outline';
import { HlmButton } from '@spartan-ng/helm/button';
import { RecipeDetailService } from '../../../dashboard/services/recipe-detail.service';

@Component({
  selector: 'app-context-recipe-card',
  standalone: true,
  imports: [NgIcon, HlmButton],
  providers: [provideIcons({ heroEye, heroEyeSlash, heroSparkles })],
  template: `
    <div class="rounded-lg border border-border bg-muted/30 px-3 py-2">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 min-w-0">
          <ng-icon hlm name="heroSparkles" class="size-4 text-primary shrink-0" />
          <span class="text-sm text-muted-foreground truncate">
            Currently viewing:
          </span>
          <span class="text-sm font-medium truncate">
            {{ recipeTitle() }}
          </span>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <button
            hlmBtn
            variant="ghost"
            size="icon"
            type="button"
            [attr.aria-label]="excluded() ? 'Include in context' : 'Exclude from context'"
            class="size-7"
            (click)="toggleExcluded.emit()"
          >
            <ng-icon
              hlm
              [name]="excluded() ? 'heroEyeSlash' : 'heroEye'"
              class="size-4"
              [class.text-muted-foreground]="excluded()"
              [class.text-primary]="!excluded()"
            />
          </button>
          <button
            hlmBtn
            variant="ghost"
            size="sm"
            type="button"
            class="h-7 text-xs"
            (click)="expandClick.emit()"
          >
            View in chat
          </button>
        </div>
      </div>
      @if (excluded()) {
        <p class="text-xs text-muted-foreground mt-1 ml-6">
          This recipe is excluded from AI context
        </p>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContextRecipeCardComponent {
  readonly recipeId = input.required<string>();
  readonly excluded = input<boolean>(false);

  readonly expandClick = output<void>();
  readonly toggleExcluded = output<void>();

  private readonly detailService = inject(RecipeDetailService);

  readonly recipeTitle = computed(() => {
    const recipe = this.detailService.recipe.value();
    if (recipe?.id === this.recipeId()) {
      return recipe.title;
    }
    return 'Recipe';
  });
}
