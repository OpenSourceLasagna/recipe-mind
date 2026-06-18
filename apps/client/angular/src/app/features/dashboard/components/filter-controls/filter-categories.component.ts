import { ChangeDetectionStrategy, Component, forwardRef, inject, signal } from '@angular/core';
import { type ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import type { ChangeFn, TouchFn } from '@spartan-ng/brain/forms';
import { RecipeCategoryService } from '../../services/recipe-category.service';

@Component({
  selector: 'app-filter-categories',
  standalone: true,
  imports: [HlmSelectImports],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => FilterCategoriesComponent),
      multi: true,
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <hlm-select-multiple [value]="_selectedValues()" (valueChange)="onValueChange($event)">
      <hlm-select-trigger class="w-full">
        <hlm-select-placeholder>Select categories</hlm-select-placeholder>
        <ng-template hlmSelectValues let-values>
          <hlm-select-values-content>
            {{ values[0] }}
            @if (values.length > 1) {
              (+{{ values.length - 1 }} more)
            }
          </hlm-select-values-content>
        </ng-template>
      </hlm-select-trigger>
      <hlm-select-content *hlmSelectPortal>
        <hlm-select-group>
          <hlm-select-label>Categories</hlm-select-label>
          @if (_categories.isLoading()) {
            <div class="px-2 py-1 text-sm text-muted-foreground">Loading…</div>
          } @else {
            @for (cat of _categories.value(); track cat.id) {
              <hlm-select-item [value]="cat.categoryName">
                {{ cat.categoryName }}
              </hlm-select-item>
            }
          }
        </hlm-select-group>
      </hlm-select-content>
    </hlm-select-multiple>
  `,
})
export class FilterCategoriesComponent implements ControlValueAccessor {
  readonly #categoryService = inject(RecipeCategoryService);
  readonly _categories = this.#categoryService.categories;
  readonly _selectedValues = signal<string[]>([]);

  #onChange?: ChangeFn<string | null>;
  #onTouched?: TouchFn;

  onValueChange(v: string[] | null | undefined): void {
    const str = v?.length ? v.join(',') : null;
    this._selectedValues.set(v ?? []);
    this.#onChange?.(str);
  }

  onTouched(): void {
    this.#onTouched?.();
  }

  writeValue(value: string | null): void {
    this._selectedValues.set(value ? value.split(',').filter(Boolean) : []);
  }

  registerOnChange(fn: ChangeFn<string | null>): void {
    this.#onChange = fn;
  }

  registerOnTouched(fn: TouchFn): void {
    this.#onTouched = fn;
  }
}
