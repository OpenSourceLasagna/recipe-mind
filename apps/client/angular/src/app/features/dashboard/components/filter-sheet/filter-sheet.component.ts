import { Component, inject, input } from '@angular/core';
import { HlmSheet, HlmSheetImports } from '@spartan-ng/helm/sheet';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmSeparator } from '@spartan-ng/helm/separator';
import { FormField } from '@angular/forms/signals';
import { RecipeFilterService } from '../../services/recipe-filter.service';
import { DURATION_RANGE, SERVINGS_RANGE } from '../../models/recipe-filter.model';
import { FilterDifficultyComponent } from '../filter-controls/filter-difficulty.component';
import { FilterSpiceRatingComponent } from '../filter-controls/filter-spice-rating.component';
import { FilterSliderRangeComponent } from '../filter-controls/filter-slider-range.component';
import { FilterOriginComponent } from '../filter-controls/filter-origin.component';
import { FilterCategoriesComponent } from '../filter-controls/filter-categories.component';
import { FilterSortComponent } from '../filter-controls/filter-sort.component';

@Component({
  selector: 'app-recipe-filter-sheet',
  standalone: true,
  imports: [
    FormField,
    HlmSheetImports,
    HlmButton,
    HlmSeparator,
    FilterDifficultyComponent,
    FilterSpiceRatingComponent,
    FilterSliderRangeComponent,
    FilterOriginComponent,
    FilterCategoriesComponent,
    FilterSortComponent,
  ],
  templateUrl: './filter-sheet.component.html',
})
export class RecipeFilterSheetComponent {
  readonly side = input<ReturnType<HlmSheet['side']>>('right');
  readonly filter = inject(RecipeFilterService);
  protected readonly durationRange = DURATION_RANGE;
  protected readonly servingsRange = SERVINGS_RANGE;

  apply(): void {
    this.filter.commit();
  }

  reset(): void {
    this.filter.resetAll();
  }
}
