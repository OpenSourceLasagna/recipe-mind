import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { RecipeCardDto } from '../../models/recipe-card.dto';
import { RecipeMetaBarComponent } from '../../../../shared/components/recipe-meta-bar/recipe-meta-bar.component';

/**
 * Compact recipe card displayed in the explore grid.
 * Uses shared RecipeMetaBarComponent for visual consistency with the detail view.
 */
@Component({
  selector: 'app-recipe-card',
  standalone: true,
  imports: [HlmCardImports, RecipeMetaBarComponent],
  templateUrl: './recipe-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeCardComponent {
  readonly recipe = input.required<RecipeCardDto>();
  readonly cardClick = output<string>();

  onClick(): void {
    this.cardClick.emit(this.recipe().id);
  }
}
