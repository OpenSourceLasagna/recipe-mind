import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroPlus, heroTrash } from '@ng-icons/heroicons/outline';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmTextareaImports } from '@spartan-ng/helm/textarea';
import { FormField } from '@angular/forms/signals';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { HlmCheckboxImports } from '@spartan-ng/helm/checkbox';
import { HlmSeparator } from '@spartan-ng/helm/separator';
import { RecipeIngredientsEditComponent } from '../../../../shared/components/recipe-ingredients-edit/recipe-ingredients-edit.component';
import { RecipeCreationStore } from '../../services/recipe-creation.store';

@Component({
  selector: 'app-recipe-creation-form',
  standalone: true,
  imports: [
    NgIcon,
    FormField,
    HlmLabelImports,
    HlmCheckboxImports,
    HlmButton,
    HlmFieldImports,
    HlmInputImports,
    HlmTextareaImports,
    HlmSeparator,
    RecipeIngredientsEditComponent,
  ],
  providers: [provideIcons({ heroPlus, heroTrash })],
  templateUrl: './recipe-creation-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeCreationFormComponent {
  readonly store = inject(RecipeCreationStore);
  readonly DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
}
