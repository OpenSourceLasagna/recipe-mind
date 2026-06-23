import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  heroArrowLeft,
  heroCheck,
  heroChevronDown,
  heroClock,
  heroDocumentDuplicate,
  heroFire,
  heroPencil,
  heroPlus,
  heroSparkles,
  heroTrash,
  heroUsers,
} from '@ng-icons/heroicons/outline';
import { FormField, form, max, min, required } from '@angular/forms/signals';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmCollapsibleImports } from '@spartan-ng/helm/collapsible';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmSeparator } from '@spartan-ng/helm/separator';
import { HlmTextarea } from '@spartan-ng/helm/textarea';
import { HlmIcon } from '@spartan-ng/helm/icon';
import { RecipeResponse } from '../../models/recipe.model';
import { RecipeIngredientResponse } from '../../models/ingredient.model';
import { Difficulty } from '../../../create-recipes/models/difficulty.model';
import { RecipePatchRequest } from '../../models/recipe-edit.model';
import { RecipeDifficultyBadgeComponent } from '../../../../shared/components/recipe-difficulty-badge/recipe-difficulty-badge.component';
import { RecipeMetaBarComponent } from '../../../../shared/components/recipe-meta-bar/recipe-meta-bar.component';
import { RecipeIngredientsEditComponent } from '../../../../shared/components/recipe-ingredients-edit/recipe-ingredients-edit.component';
import {
  computeRecipeDiff,
  getChangedFieldNames,
  type RecipeDiff,
  type IngredientDiffItem,
  type TextListDiffItem,
  type NutritionDiffItem,
} from '../../utils/recipe-diff.utils';

interface EditFormModel {
  title: string;
  origin: string;
  servings: number;
  durationMinutes: number;
  difficulty: Difficulty;
  spiceLevel: number;
  isPublic: boolean;
}

@Component({
  selector: 'app-recipe-detail-view',
  standalone: true,
  imports: [
    NgIcon,
    FormField,
    HlmBadgeImports,
    HlmButton,
    HlmCardImports,
    HlmCollapsibleImports,
    HlmFieldImports,
    HlmInput,
    HlmSeparator,
    HlmTextarea,
    HlmIcon,
    RecipeDifficultyBadgeComponent,
    RecipeMetaBarComponent,
    RecipeIngredientsEditComponent,
  ],
  providers: [
    provideIcons({
      heroArrowLeft,
      heroSparkles,
      heroClock,
      heroFire,
      heroUsers,
      heroPencil,
      heroCheck,
      heroTrash,
      heroPlus,
      heroChevronDown,
      heroDocumentDuplicate,
    }),
  ],
  templateUrl: './recipe-detail-view.component.html',
  styleUrl: './recipe-detail-view.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeDetailViewComponent {
  readonly recipe = input.required<RecipeResponse>();

  readonly modifiedRecipe = input<RecipeResponse | null>(null);

  readonly isOwner = input<boolean>(false);

  readonly isEditing = input<boolean>(false);

  readonly viewMode = model<'original' | 'modified'>('original');

  readonly autoSwitchToChanges = input(false);

  readonly variant = input<'page' | 'inline'>('page');

  readonly showChatButton = input(true);

  readonly backClick = output<void>();
  readonly editClick = output<void>();
  readonly saveClick = output<RecipePatchRequest>();
  readonly cancelEditClick = output<void>();
  readonly chatClick = output<void>();
  readonly saveAsCopyClick = output<RecipeResponse>();
  readonly dismissChangesClick = output<void>();

  readonly DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

  readonly hasModified = computed(() => this.modifiedRecipe() !== null);

  readonly recipeDiff = computed((): RecipeDiff | null => {
    const mod = this.modifiedRecipe();
    if (!mod) return null;
    return computeRecipeDiff(this.recipe(), mod);
  });

  readonly showVersionToggle = computed(() => {
    if (!this.hasModified()) return false;
    return this.changedFields().size > 0;
  });

  /** Always returns the original recipe — diffs are overlaid in the template. */
  readonly activeRecipe = computed(() => this.recipe());

  /** Set of field names that differ between original and modified. */
  readonly changedFields = computed(() => {
    const mod = this.modifiedRecipe();
    if (!mod) return new Set<string>();
    return getChangedFieldNames(this.recipe(), mod);
  });

  /** Section-level change indicators. */
  readonly ingredientsChanged = computed(() => this.changedFields().has('ingredients'));
  readonly instructionsChanged = computed(() => this.changedFields().has('instructionSteps'));
  readonly nutritionChanged = computed(() => this.changedFields().has('nutrition'));
  readonly additionalInfoChanged = computed(() =>
    this.changedFields().has('additionalInformation'),
  );
  readonly metaChanged = computed(() => {
    const cf = this.changedFields();
    return (
      cf.has('servings') ||
      cf.has('durationMinutes') ||
      cf.has('difficulty') ||
      cf.has('spiceLevel') ||
      cf.has('origin')
    );
  });

  /** Whether the recipe has any nutrition data (original or modified depending on mode). */
  readonly hasNutrition = computed(() => {
    if (this.viewMode() === 'modified') {
      const diff = this.recipeDiff();
      if (diff) return diff.nutrition.length > 0;
    }
    const n = this.recipe().nutrition;
    return n && Object.keys(n).length > 0;
  });

  /** Nutrition entries — diff-aware. */
  readonly nutritionEntries = computed(() => {
    if (this.viewMode() === 'modified') {
      const diff = this.recipeDiff();
      if (diff) {
        return diff.nutrition.map((entry) => ({
          key: entry.key.charAt(0).toUpperCase() + entry.key.slice(1),
          value: String(
            entry.modified !== null ? entry.modified : entry.original ?? '',
          ),
          status: entry.status,
          original: entry.original !== null ? String(entry.original) : null,
        }));
      }
    }
    const n = this.recipe().nutrition;
    if (!n) return [];
    return Object.entries(n).map(([key, value]) => ({
      key: key.charAt(0).toUpperCase() + key.slice(1),
      value: String(value),
      status: 'unchanged' as const,
      original: null,
    }));
  });

  /** Whether the recipe has additional information. */
  readonly hasAdditionalInfo = computed(() => {
    if (this.viewMode() === 'modified') {
      const diff = this.recipeDiff();
      if (diff) return diff.additionalInformation.length > 0;
    }
    return this.recipe().additionalInformation.length > 0;
  });

  /** Ingredient items for display — diff-aware. */
  readonly displayIngredients = computed(() => {
    if (this.viewMode() === 'modified') {
      const diff = this.recipeDiff();
      if (diff) return diff.ingredients;
    }
    return this.recipe().ingredients.map((i) => ({
      status: 'unchanged' as const,
      original: i,
      modified: i,
    }));
  });

  /** Instruction steps for display — diff-aware. */
  readonly displayInstructions = computed(() => {
    if (this.viewMode() === 'modified') {
      const diff = this.recipeDiff();
      if (diff) return diff.instructionSteps;
    }
    return this.recipe().instructionSteps.map((text, idx) => ({
      status: 'unchanged' as const,
      index: idx,
      original: text,
      modified: text,
    }));
  });

  /** Additional info items for display — diff-aware. */
  readonly displayAdditionalInfo = computed(() => {
    if (this.viewMode() === 'modified') {
      const diff = this.recipeDiff();
      if (diff) return diff.additionalInformation;
    }
    return this.recipe().additionalInformation.map((text, idx) => ({
      status: 'unchanged' as const,
      index: idx,
      original: text,
      modified: text,
    }));
  });

  readonly #editModel = signal<EditFormModel>({
    title: '',
    origin: '',
    servings: 4,
    durationMinutes: 30,
    difficulty: 'medium',
    spiceLevel: 2,
    isPublic: false,
  });

  readonly editForm = form(this.#editModel, (f) => {
    required(f.title);
    min(f.servings, 1);
    min(f.durationMinutes, 0);
    min(f.spiceLevel, 1);
    max(f.spiceLevel, 5);
  });

  readonly editIngredients = signal<RecipeIngredientResponse[]>([]);
  readonly editIngredientsTouched = signal(false);
  readonly editIngredientsAreValid = computed(() => {
    const list = this.editIngredients();
    return list.every((row) => row.ingredientName.trim().length > 0 && row.quantity > 0);
  });
  readonly editInstructions = signal<string[]>([]);
  readonly editAdditionalInfo = signal<string[]>([]);

  #userSelectedViewMode = false;

  constructor() {
    effect(() => {
      const editing = this.isEditing();
      const active = this.activeRecipe();
      if (!editing || !active) return;

      this.#editModel.set({
        title: active.title,
        origin: active.origin,
        servings: active.servings,
        durationMinutes: active.durationMinutes,
        difficulty: active.difficulty,
        spiceLevel: active.spiceLevel,
        isPublic: active.isPublic,
      });
      this.editIngredients.set(active.ingredients.map((i) => ({ ...i })));
      this.editInstructions.set([...active.instructionSteps]);
      this.editAdditionalInfo.set([...active.additionalInformation]);
    });

    effect(() => {
      if (
        this.autoSwitchToChanges() &&
        this.hasModified() &&
        !this.#userSelectedViewMode
      ) {
        this.viewMode.set('modified');
      }
    });
  }

  setViewMode(mode: 'original' | 'modified'): void {
    this.#userSelectedViewMode = true;
    this.viewMode.set(mode);
  }

  addInstruction(): void {
    this.editInstructions.update((list) => [...list, '']);
  }

  removeInstruction(index: number): void {
    this.editInstructions.update((list) => list.filter((_, i) => i !== index));
  }

  updateInstruction(index: number, value: string): void {
    this.editInstructions.update((list) => list.map((step, i) => (i === index ? value : step)));
  }

  onInstructionInput(index: number, event: Event): void {
    this.updateInstruction(index, (event.target as HTMLTextAreaElement).value);
  }

  addAdditionalInfo(): void {
    this.editAdditionalInfo.update((list) => [...list, '']);
  }

  removeAdditionalInfo(index: number): void {
    this.editAdditionalInfo.update((list) => list.filter((_, i) => i !== index));
  }

  updateAdditionalInfo(index: number, value: string): void {
    this.editAdditionalInfo.update((list) => list.map((item, i) => (i === index ? value : item)));
  }

  onAdditionalInfoInput(index: number, event: Event): void {
    this.updateAdditionalInfo(index, (event.target as HTMLTextAreaElement).value);
  }

  onSpiceLevelInput(event: Event): void {
    this.editForm.spiceLevel().value.set(+(event.target as HTMLInputElement).value);
  }

  onSave(): void {
    if (!this.editForm().valid()) return;

    const active = this.activeRecipe();
    const patch: RecipePatchRequest = {};

    function setIfChanged<T>(field: keyof RecipePatchRequest, value: T, compareTo: T) {
      if (value !== compareTo) (patch as Record<string, unknown>)[field] = value;
    }

    setIfChanged('title', this.editForm.title().value().trim(), active.title);
    setIfChanged('origin', this.editForm.origin().value().trim(), active.origin);
    setIfChanged('servings', this.editForm.servings().value(), active.servings);
    setIfChanged('durationMinutes', this.editForm.durationMinutes().value(), active.durationMinutes);
    setIfChanged('difficulty', this.editForm.difficulty().value(), active.difficulty);
    setIfChanged('spiceLevel', this.editForm.spiceLevel().value(), active.spiceLevel);
    setIfChanged('isPublic', this.editForm.isPublic().value(), active.isPublic);

    const instructions = this.editInstructions().filter((s) => s.trim().length);
    if (JSON.stringify(instructions) !== JSON.stringify(active.instructionSteps)) {
      patch.instructionSteps = instructions;
    }

    const additional = this.editAdditionalInfo().filter((s) => s.trim().length);
    if (JSON.stringify(additional) !== JSON.stringify(active.additionalInformation)) {
      patch.additionalInformation = additional;
    }

    const ingredients = this.editIngredients()
      .filter((i) => i.ingredientName.trim().length > 0)
      .map((i) => ({
        ingredientName: i.ingredientName.trim(),
        quantity: i.quantity,
        unit: i.unit.trim(),
      }));
    if (JSON.stringify(ingredients) !== JSON.stringify(active.ingredients)) {
      patch.ingredients = ingredients;
    }

    this.saveClick.emit(patch);
  }

  onSaveAsCopy(): void {
    const modified = this.modifiedRecipe();
    if (modified) {
      this.saveAsCopyClick.emit(modified);
    }
  }

  onDismissChanges(): void {
    this.dismissChangesClick.emit();
    this.viewMode.set('original');
  }
}
