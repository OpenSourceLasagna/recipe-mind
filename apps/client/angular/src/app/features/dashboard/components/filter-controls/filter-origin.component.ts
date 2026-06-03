import { ChangeDetectionStrategy, Component, forwardRef, model } from '@angular/core';
import { type ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { HlmInput } from '@spartan-ng/helm/input';
import type { ChangeFn, TouchFn } from '@spartan-ng/brain/forms';

@Component({
  selector: 'app-filter-origin',
  standalone: true,
  imports: [HlmInput],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => FilterOriginComponent),
      multi: true,
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <input hlmInput class="w-full" [value]="value() ?? ''" (input)="onInput($event)" (blur)="onTouched()" placeholder="e.g. Italian, Mexican..." />
  `,
})
export class FilterOriginComponent implements ControlValueAccessor {
  readonly value = model<string | null>(null);

  #onChange?: ChangeFn<string | null>;
  #onTouched?: TouchFn;

  onInput(event: Event): void {
    const v = (event.target as HTMLInputElement).value || null;
    this.value.set(v);
    this.#onChange?.(v);
  }

  onTouched(): void {
    this.#onTouched?.();
  }

  writeValue(value: string | null): void {
    this.value.set(value);
  }

  registerOnChange(fn: ChangeFn<string | null>): void {
    this.#onChange = fn;
  }

  registerOnTouched(fn: TouchFn): void {
    this.#onTouched = fn;
  }
}
