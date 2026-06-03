import { Component, ElementRef, inject, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroChevronDown } from '@ng-icons/heroicons/outline';
import { FormField } from '@angular/forms/signals';
import { HlmPopoverImports } from '@spartan-ng/helm/popover';
import { HlmButton } from '@spartan-ng/helm/button';
import { RecipeFilterService } from '../../services/recipe-filter.service';
import { DURATION_RANGE, SERVINGS_RANGE } from '../../models/recipe-filter.model';
import { FilterDifficultyComponent } from '../filter-controls/filter-difficulty.component';
import { FilterSpiceRatingComponent } from '../filter-controls/filter-spice-rating.component';
import { FilterSliderRangeComponent } from '../filter-controls/filter-slider-range.component';
import { FilterOriginComponent } from '../filter-controls/filter-origin.component';
import { FilterCategoriesComponent } from '../filter-controls/filter-categories.component';
import { FilterSortComponent } from '../filter-controls/filter-sort.component';

@Component({
  selector: 'app-filter-bar',
  standalone: true,
  imports: [
    FormField,
    HlmPopoverImports,
    HlmButton,
    NgIcon,
    FilterDifficultyComponent,
    FilterSpiceRatingComponent,
    FilterSliderRangeComponent,
    FilterOriginComponent,
    FilterCategoriesComponent,
    FilterSortComponent,
  ],
  providers: [provideIcons({ heroChevronDown })],
  templateUrl: './filter-bar.component.html',
})
export class FilterBarComponent {
  readonly filter = inject(RecipeFilterService);
  readonly difficultyPopoverContent = viewChild<ElementRef>('difficultyPopoverContent');
  protected readonly durationRange = DURATION_RANGE;
  protected readonly servingsRange = SERVINGS_RANGE;
}
