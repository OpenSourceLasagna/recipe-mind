import { ChangeDetectionStrategy, Component, forwardRef, model } from '@angular/core';
import { type ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { HlmToggleGroupImports } from '@spartan-ng/helm/toggle-group';
import type { ChangeFn, TouchFn } from '@spartan-ng/brain/forms';
import type { Difficulty } from '../../../create-recipes/models/difficulty.model';

@Component({
  selector: 'app-filter-difficulty',
  standalone: true,
  imports: [HlmToggleGroupImports],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => FilterDifficultyComponent),
      multi: true,
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div hlmToggleGroup type="single" [nullable]="true"
      [value]="value()"
      (valueChange)="onSelect($event)">
      <button hlmToggleGroupItem value="easy" class="capitalize">Easy</button>
      <button hlmToggleGroupItem value="medium" class="capitalize">Medium</button>
      <button hlmToggleGroupItem value="hard" class="capitalize">Hard</button>
    </div>
  `,
})
export class FilterDifficultyComponent implements ControlValueAccessor {
  readonly value = model<Difficulty | null>(null);

  #onChange?: ChangeFn<Difficulty | null>;
  #onTouched?: TouchFn;

  onSelect(event: unknown): void {
    const v = event as Difficulty | null;
    this.value.set(v);
    this.#onChange?.(v);
    this.#onTouched?.();
  }

  writeValue(value: Difficulty | null): void {
    this.value.set(value);
  }

  registerOnChange(fn: ChangeFn<Difficulty | null>): void {
    this.#onChange = fn;
  }

  registerOnTouched(fn: TouchFn): void {
    this.#onTouched = fn;
  }
}
