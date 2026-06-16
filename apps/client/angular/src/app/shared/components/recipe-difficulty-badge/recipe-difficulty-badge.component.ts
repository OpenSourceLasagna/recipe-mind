import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { Difficulty } from '../../../features/create-recipes/models/difficulty.model';

/**
 * Consistent difficulty badge with deterministic color coding.
 * Used in recipe cards, detail views, meta bars, and forms.
 */
@Component({
  selector: 'app-recipe-difficulty-badge',
  standalone: true,
  imports: [HlmBadgeImports],
  templateUrl: './recipe-difficulty-badge.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeDifficultyBadgeComponent {
  readonly difficulty = input.required<Difficulty>();

  readonly badgeClass = computed(() => {
    switch (this.difficulty()) {
      case 'easy':
        return 'text-emerald-500 border-emerald-500/30';
      case 'medium':
        return 'text-amber-500 border-amber-500/30';
      case 'hard':
        return 'text-red-500 border-red-500/30';
      default:
        return '';
    }
  });
}
