import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroMagnifyingGlass, heroXMark } from '@ng-icons/heroicons/outline';
import { HlmInput, HlmInputImports } from '@spartan-ng/helm/input';
import { RecipeFilterService } from '../../services/recipe-filter.service';
import { form, FormField } from '@angular/forms/signals';
import { HlmField, HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmButtonGroupImports } from '@spartan-ng/helm/button-group';

@Component({
  selector: 'app-recipe-search-bar',
  standalone: true,
  imports: [HlmInputImports, NgIcon, FormField, HlmFieldImports, HlmButtonGroupImports, HlmButtonImports],
  providers: [provideIcons({ heroMagnifyingGlass, heroXMark })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './recipe-search-bar.component.html',
})
export class RecipeSearchBarComponent {
  #filterService = inject(RecipeFilterService);
  readonly filterQuery = this.#filterService.query;
  readonly #queryValue = signal({ query: this.filterQuery() ?? '' });
  readonly queryForm = form(this.#queryValue);
  readonly showClear = computed(() => this.queryForm.query().value().length > 0 || (this.filterQuery()?.length ?? 0) > 0);
  #lastSubmittedValue = this.filterQuery() ?? '';

  constructor() {
    effect(() => {
      const q = this.filterQuery();
      const inputValue = untracked(this.queryForm.query().value);
      if (q !== inputValue) {
        this.#queryValue.set({ query: q ?? '' });
      }
    });
  }

  submit(event?: Event): void {
    event?.preventDefault();
    const currentValue = this.queryForm.query().value() || '';
    if (currentValue === this.#lastSubmittedValue) {
      return;
    }
    this.#lastSubmittedValue = currentValue;
    this.#filterService.setQuery(this.queryForm.query().value() || null);
  }

  clear(event?: Event): void {
    event?.preventDefault();
    this.#queryValue.set({ query: '' });
    this.submit();
  }
}
