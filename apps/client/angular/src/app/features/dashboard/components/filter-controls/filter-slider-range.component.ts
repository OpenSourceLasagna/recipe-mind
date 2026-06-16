import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  input,
  model,
} from '@angular/core';
import { type ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import type { ChangeFn, TouchFn } from '@spartan-ng/brain/forms';
import type { RangeTuple } from '../../models/recipe-filter.model';
import { HlmSliderImports } from '@spartan-ng/helm/slider';

@Component({
  selector: 'app-filter-slider-range',
  standalone: true,
  imports: [HlmSliderImports],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => FilterSliderRangeComponent),
      multi: true,
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-2 w-full min-w-[180px]">
      <div class="flex items-center justify-between">
        <span class="text-xs text-muted-foreground">{{ label() }}</span>
        <span class="text-sm font-medium">{{ rangeLabel() }}</span>
      </div>
      <hlm-slider
        [value]="sliderValue()"
        (valueChange)="onSliderChange($any($event))"
        [min]="sliderMin()"
        [max]="sliderMax()"
        [step]="step()"
        [showTicks]="true"
        [minStepsBetweenThumbs]="0"
      />
    </div>
  `,
})
export class FilterSliderRangeComponent implements ControlValueAccessor {
  readonly value = model<RangeTuple>([0, 100]);

  readonly sliderMin = input(0);
  readonly sliderMax = input(100);
  readonly step = input(1);
  readonly unit = input('');
  readonly label = input('');

  protected readonly thumbs = [0, 1];

  #onChange?: ChangeFn<RangeTuple>;
  #onTouched?: TouchFn;

  readonly sliderValue = computed<number[]>(() => [...this.value()]);

  readonly rangeLabel = computed(() => {
    const [lo, hi] = this.value();
    const u = this.unit();
    return u ? `${lo} – ${hi} ${u}` : `${lo} – ${hi}`;
  });

  onSliderChange(values: number[]): void {
    const next: RangeTuple = [values[0], values[1]];
    this.value.set(next);
    this.#onChange?.(next);
    this.#onTouched?.();
  }

  writeValue(value: RangeTuple): void {
    this.value.set(value);
  }

  registerOnChange(fn: ChangeFn<RangeTuple>): void {
    this.#onChange = fn;
  }

  registerOnTouched(fn: TouchFn): void {
    this.#onTouched = fn;
  }
}
