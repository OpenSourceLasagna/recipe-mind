import { ChangeDetectionStrategy, Component, computed, forwardRef, model } from '@angular/core';
import { type ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroArrowUp, heroArrowDown } from '@ng-icons/heroicons/outline';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import type { ChangeFn, TouchFn } from '@spartan-ng/brain/forms';
import { SORT_BY_LABELS, type SortByField, type SortOrder, type SortValue } from '../../models/recipe-filter.model';

@Component({
  selector: 'app-filter-sort',
  standalone: true,
  imports: [HlmButton, NgIcon, HlmDropdownMenuImports],
  providers: [
    provideIcons({ arrowUp: heroArrowUp, arrowDown: heroArrowDown}),
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => FilterSortComponent),
      multi: true,
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button hlmBtn variant="secondary" size="sm" [hlmDropdownMenuTrigger]="sortMenu" class="w-[10em]">
      {{ currentLabel() }}
      <ng-icon [name]="value().sortOrder === 'asc' ? 'arrowUp' : 'arrowDown'" />
    </button>

    <ng-template #sortMenu>
      <hlm-dropdown-menu class="w-56">
        <hlm-dropdown-menu-label>Sort By</hlm-dropdown-menu-label>
        <hlm-dropdown-menu-separator />
        @for (key of sortByKeys; track key) {
          <button hlmDropdownMenuRadio
            [checked]="value().sortBy === key"
            (triggered)="selectField(key)">
            <hlm-dropdown-menu-radio-indicator />
            {{ sortByLabels[key] }}
          </button>
        }
        <hlm-dropdown-menu-separator />
        <hlm-dropdown-menu-label>Order</hlm-dropdown-menu-label>
        <button hlmDropdownMenuRadio
          [checked]="value().sortOrder === 'asc'"
          (triggered)="selectOrder('asc')">
          <hlm-dropdown-menu-radio-indicator />
          <span class="flex items-center gap-2">
            <ng-icon hlm size="sm" name="arrowUp" />
            Ascending
          </span>
        </button>
        <button hlmDropdownMenuRadio
          [checked]="value().sortOrder === 'desc'"
          (triggered)="selectOrder('desc')">
          <hlm-dropdown-menu-radio-indicator />
          <span class="flex items-center gap-2">
            <ng-icon hlm size="sm" name="arrowDown" />
            Descending
          </span>
        </button>
      </hlm-dropdown-menu>
    </ng-template>
  `,
})
export class FilterSortComponent implements ControlValueAccessor {
  readonly value = model<SortValue>({ sortBy: 'created_at', sortOrder: 'desc' });

  protected readonly sortByLabels = SORT_BY_LABELS;
  protected readonly sortByKeys: SortByField[] = Object.keys(SORT_BY_LABELS) as SortByField[];

  #onChange?: ChangeFn<SortValue>;
  #onTouched?: TouchFn;

  readonly currentLabel = computed(() => SORT_BY_LABELS[this.value().sortBy]);

  selectField(key: SortByField): void {
    const next: SortValue = { ...this.value(), sortBy: key };
    this.value.set(next);
    this.#onChange?.(next);
    this.#onTouched?.();
  }

  selectOrder(order: SortOrder): void {
    const next: SortValue = { ...this.value(), sortOrder: order };
    this.value.set(next);
    this.#onChange?.(next);
    this.#onTouched?.();
  }

  writeValue(value: SortValue): void {
    this.value.set(value);
  }

  registerOnChange(fn: ChangeFn<SortValue>): void {
    this.#onChange = fn;
  }

  registerOnTouched(fn: TouchFn): void {
    this.#onTouched = fn;
  }
}
