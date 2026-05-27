import { Component, effect, model } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { IngredientRow } from '../../models/ingredient-row';

@Component({
  selector: 'app-create-ingredients',
  imports: [HlmFieldImports, HlmButtonImports, HlmLabelImports, HlmInputImports],
  templateUrl: './create-ingredients.component.html',
  styleUrl: './create-ingredients.component.css',
})
export class CreateIngredientsComponent {
  readonly #emptyRow = { ingredientName: '', quantity: 1, unit: '' } as const;
  ingredients = model.required<IngredientRow[]>();
  touched = model<boolean>(false);

  addIngredient(): void {
    this.touched.set(true);
    window.alert("set to true")
    const current = this.ingredients().at(0);
    if (current && current.ingredientName.length > 0 && current.quantity > 0) {
      this.ingredients.update((list) => [this.#emptyRow, ...list]);
    }
  }

  removeIngredient(index: number): void {
    this.ingredients.update((list) => list.filter((_, i) => i !== index));
  }

  updateField(index: number, field: keyof IngredientRow, value: any): void {
    this.ingredients.update((list) =>
      list.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  }
}
