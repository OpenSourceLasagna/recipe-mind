import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroClock, heroUsers } from '@ng-icons/heroicons/outline';
import { RecipeDifficultyBadgeComponent } from '../recipe-difficulty-badge/recipe-difficulty-badge.component';
import { RecipeSpiceRatingComponent } from '../recipe-spice-rating/recipe-spice-rating.component';
import { Difficulty } from '../../../features/create-recipes/models/difficulty.model';

export interface RecipeMeta {
  difficulty: Difficulty;
  durationMinutes: number;
  servings: number;
  spiceLevel: number;
  origin?: string;
}

/**
 * Compact horizontal bar showing key recipe metadata.
 * Used in recipe cards, detail views, and inline previews.
 * Ensures visual consistency across the entire app.
 */
@Component({
  selector: 'app-recipe-meta-bar',
  standalone: true,
  imports: [NgIcon, RecipeDifficultyBadgeComponent, RecipeSpiceRatingComponent],
  providers: [provideIcons({ heroClock, heroUsers })],
  templateUrl: './recipe-meta-bar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeMetaBarComponent {
  readonly difficulty = input.required<Difficulty>();
  readonly durationMinutes = input.required<number>();
  readonly servings = input.required<number>();
  readonly spiceLevel = input.required<number>();
  readonly origin = input<string>('');

  readonly showOrigin = input<boolean>(false);
  readonly showDifficulty = input<boolean>(true);
  readonly iconSize = input<'sm' | 'md'>('md');
  readonly compact = input<boolean>(false);

  readonly iconClass = 'size-4';
}
