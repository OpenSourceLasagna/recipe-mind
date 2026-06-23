import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroPlus, heroTrash } from '@ng-icons/heroicons/outline';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { IngredientEditRow } from '../../models/ingredient-edit-row.model';

/**
 * Beautiful, reusable editable ingredient list.
 *
 * Desktop: clean table-style layout with proportional columns.
 * Mobile: compact stacked layout.
 *
 * UX features:
 * - "Add ingredient" always at the bottom (never hidden on first row)
 * - Subtle ghost delete button per row (not aggressive red)
 * - Full-width ingredient name (primary field)
 * - Proper placeholders and column headers
 * - Tab-friendly input order: qty → unit → name → (new row)
 */
@Component({
  selector: 'app-recipe-ingredients-edit',
  standalone: true,
  imports: [NgIcon, HlmButton, HlmInput],
  providers: [provideIcons({ heroPlus, heroTrash })],
  templateUrl: './recipe-ingredients-edit.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeIngredientsEditComponent {
  /** Two-way bindable ingredient list. */
  readonly ingredients = model.required<IngredientEditRow[]>();

  /** Whether the list has been touched (for validation display). */
  readonly touched = model<boolean>(false);

  /** Whether to show validation error state. */
  readonly showError = input<boolean>(false);

  /** Error message to display when showError is true. */
  readonly errorMessage = input<string | null>(null);

  /** Whether the list is valid (every row has a name and positive quantity). */
  readonly isValid = computed(() => {
    const list = this.ingredients();
    return list.every((row) => row.ingredientName.trim().length > 0 && row.quantity > 0);
  });

  readonly hasError = computed(() => this.showError() && !!this.errorMessage());

  /** Add a new empty ingredient row at the bottom. */
  addIngredient(): void {
    this.ingredients.update((list) => [...list, { ingredientName: '', quantity: 0, unit: '' }]);
    this.touched.set(true);
  }

  /** Remove an ingredient row by index. */
  removeIngredient(index: number): void {
    this.ingredients.update((list) => list.filter((_, i) => i !== index));
    this.touched.set(true);
  }

  /** Update a single field of an ingredient row. */
  updateIngredient(index: number, patch: Partial<IngredientEditRow>): void {
    this.ingredients.update((list) =>
      list.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
    this.touched.set(true);
  }

  onQuantityInput(index: number, event: Event): void {
    this.updateIngredient(index, { quantity: +(event.target as HTMLInputElement).value });
  }

  onUnitInput(index: number, event: Event): void {
    this.updateIngredient(index, { unit: (event.target as HTMLInputElement).value });
  }

  onNameInput(index: number, event: Event): void {
    this.updateIngredient(index, { ingredientName: (event.target as HTMLInputElement).value });
  }

  /** Track by index for performance (rows are ephemeral during editing). */
  trackByIndex(index: number): number {
    return index;
  }
}
