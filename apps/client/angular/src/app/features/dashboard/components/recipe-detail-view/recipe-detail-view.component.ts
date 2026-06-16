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
    }),
  ],
  templateUrl: './recipe-detail-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeDetailViewComponent {
  readonly recipe = input.required<RecipeResponse>();

  readonly modifiedRecipe = input<RecipeResponse | null>(null);

  readonly isOwner = input<boolean>(false);

  readonly isEditing = input<boolean>(false);

  readonly viewMode = model<'original' | 'modified'>('original');

  readonly backClick = output<void>();
  readonly editClick = output<void>();
  readonly saveClick = output<RecipePatchRequest>();
  readonly cancelEditClick = output<void>();
  readonly chatClick = output<void>();

  readonly DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

  readonly hasModified = computed(() => this.modifiedRecipe() !== null);

  /** The recipe currently displayed (original or modified). */
  readonly activeRecipe = computed(() => {
    if (this.viewMode() === 'modified' && this.modifiedRecipe()) {
      return this.modifiedRecipe()!;
    }
    return this.recipe();
  });

  /** Set of field names that differ between original and modified. */
  readonly changedFields = computed(() => {
    const mod = this.modifiedRecipe();
    if (!mod) return new Set<string>();

    const orig = this.recipe();
    const changed = new Set<string>();

    if (orig.title !== mod.title) changed.add('title');
    if (orig.servings !== mod.servings) changed.add('servings');
    if (orig.durationMinutes !== mod.durationMinutes) changed.add('durationMinutes');
    if (orig.difficulty !== mod.difficulty) changed.add('difficulty');
    if (orig.spiceLevel !== mod.spiceLevel) changed.add('spiceLevel');
    if (orig.origin !== mod.origin) changed.add('origin');
    if (orig.isPublic !== mod.isPublic) changed.add('isPublic');

    if (JSON.stringify(orig.additionalInformation) !== JSON.stringify(mod.additionalInformation)) {
      changed.add('additionalInformation');
    }
    if (JSON.stringify(orig.ingredients) !== JSON.stringify(mod.ingredients)) {
      changed.add('ingredients');
    }
    if (JSON.stringify(orig.instructionSteps) !== JSON.stringify(mod.instructionSteps)) {
      changed.add('instructionSteps');
    }
    if (JSON.stringify(orig.nutrition) !== JSON.stringify(mod.nutrition)) {
      changed.add('nutrition');
    }

    return changed;
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

  /** Whether the recipe has any nutrition data. */
  readonly hasNutrition = computed(() => {
    const n = this.activeRecipe().nutrition;
    return n && Object.keys(n).length > 0;
  });

  /** Nutrition entries as a list for the template. */
  readonly nutritionEntries = computed(() => {
    const n = this.activeRecipe().nutrition;
    if (!n) return [];
    return Object.entries(n).map(([key, value]) => ({
      key: key.charAt(0).toUpperCase() + key.slice(1),
      value: String(value),
    }));
  });

  /** Whether the recipe has additional information. */
  readonly hasAdditionalInfo = computed(() => this.activeRecipe().additionalInformation.length > 0);

  // ── Edit form state ──

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

  constructor() {
    // Seed edit form whenever edit mode activates
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
  }

  // ── Version toggle ──

  setViewMode(mode: 'original' | 'modified'): void {
    this.viewMode.set(mode);
  }

  // ── Edit helpers ──

  addInstruction(): void {
    this.editInstructions.update((list) => [...list, '']);
  }

  removeInstruction(index: number): void {
    this.editInstructions.update((list) => list.filter((_, i) => i !== index));
  }

  updateInstruction(index: number, value: string): void {
    this.editInstructions.update((list) => list.map((step, i) => (i === index ? value : step)));
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

  onSave(): void {
    if (!this.editForm().valid()) {
      return;
    }

    const active = this.activeRecipe();
    const patch: RecipePatchRequest = {};

    const title = this.editForm.title().value().trim();
    if (title !== active.title) patch.title = title;

    const origin = this.editForm.origin().value().trim();
    if (origin !== active.origin) patch.origin = origin;

    const servings = this.editForm.servings().value();
    if (servings !== active.servings) patch.servings = servings;

    const durationMinutes = this.editForm.durationMinutes().value();
    if (durationMinutes !== active.durationMinutes) patch.durationMinutes = durationMinutes;

    const difficulty = this.editForm.difficulty().value();
    if (difficulty !== active.difficulty) patch.difficulty = difficulty;

    const spiceLevel = this.editForm.spiceLevel().value();
    if (spiceLevel !== active.spiceLevel) patch.spiceLevel = spiceLevel;

    const isPublic = this.editForm.isPublic().value();
    if (isPublic !== active.isPublic) patch.isPublic = isPublic;

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
}
