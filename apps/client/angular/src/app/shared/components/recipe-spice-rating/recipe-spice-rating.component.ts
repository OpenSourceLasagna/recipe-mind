import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroFire } from '@ng-icons/heroicons/outline';

/**
 * Fire-icon spice rating display.
 * Used in recipe cards, detail views, and meta bars.
 */
@Component({
  selector: 'app-recipe-spice-rating',
  standalone: true,
  imports: [NgIcon],
  providers: [provideIcons({ heroFire })],
  templateUrl: './recipe-spice-rating.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeSpiceRatingComponent {
  /** Spice level 1-5 */
  readonly spiceLevel = input.required<number>();

  /** Icon size variant */
  readonly size = input<'sm' | 'md' | 'lg'>('md');

  readonly iconSizeClass = 'size-4';
  private readonly sizes = [1, 2, 3, 4, 5];
  readonly spiceArray = this.sizes;
}
