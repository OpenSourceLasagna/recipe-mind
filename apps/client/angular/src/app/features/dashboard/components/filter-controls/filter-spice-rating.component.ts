import { ChangeDetectionStrategy, Component, computed, forwardRef, model } from '@angular/core';
import { type ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroFire } from '@ng-icons/heroicons/outline';
import type { ChangeFn, TouchFn } from '@spartan-ng/brain/forms';

@Component({
  selector: 'app-filter-spice-rating',
  standalone: true,
  imports: [NgIcon],
  providers: [
    provideIcons({ heroFire }),
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => FilterSpiceRatingComponent),
      multi: true,
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col items-center gap-1.5">
      <div class="flex items-center gap-1" role="radiogroup" aria-label="Spice level">
        @for (level of levels; track level) {
          <button
            type="button"
            class="p-0.5 transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
            [attr.aria-label]="'Spice level ' + level"
            [attr.aria-checked]="isActive(level)"
            (click)="select(level)"
          >
            <ng-icon
              name="heroFire"
              class="size-6 transition-colors"
              [class.text-orange-500]="isActive(level)"
              [class.text-muted-foreground/20]="!isActive(level)"
            />
          </button>
        }
      </div>
      @if (label(); as l) {
        <span class="text-xs font-medium text-muted-foreground">{{ l }}</span>
      }
    </div>
  `,
})
export class FilterSpiceRatingComponent implements ControlValueAccessor {
  readonly value = model<number | null>(null);

  protected readonly levels = [1, 2, 3, 4, 5];

  #onChange?: ChangeFn<number | null>;
  #onTouched?: TouchFn;

  readonly label = computed(() => {
    const v = this.value();
    if (v === null) return null;
    if (v <= 2) return 'Mild';
    if (v === 3) return 'Medium';
    if (v === 4) return 'Hot';
    return 'Very Hot';
  });

  isActive(level: number): boolean {
    const current = this.value();
    return current !== null && level <= current;
  }

  select(level: number): void {
    const current = this.value();
    const next = current === level ? null : level;
    this.value.set(next);
    this.#onChange?.(next);
    this.#onTouched?.();
  }

  writeValue(value: number | null): void {
    this.value.set(value);
  }

  registerOnChange(fn: ChangeFn<number | null>): void {
    this.#onChange = fn;
  }

  registerOnTouched(fn: TouchFn): void {
    this.#onTouched = fn;
  }
}
