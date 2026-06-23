import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  heroArrowsPointingOut,
  heroChevronDown,
  heroChevronUp,
  heroEye,
  heroPencil,
  heroSparkles,
  heroXMark,
  heroDocumentDuplicate,
} from '@ng-icons/heroicons/outline';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { TitleCasePipe } from '@angular/common';
import { RecipeDetailViewComponent } from '../../../dashboard/components/recipe-detail-view/recipe-detail-view.component';
import { RecipeContext } from '../../models/chat-message.model';
import { RecipePatchRequest } from '../../../dashboard/models/recipe-edit.model';
import { RecipeResponse } from '../../../dashboard/models/recipe.model';

@Component({
  selector: 'app-recipe-message',
  standalone: true,
  imports: [NgIcon, HlmButton, HlmBadge, RecipeDetailViewComponent, TitleCasePipe],
  providers: [
    provideIcons({
      heroArrowsPointingOut,
      heroChevronDown,
      heroChevronUp,
      heroEye,
      heroPencil,
      heroSparkles,
      heroXMark,
      heroDocumentDuplicate,
    }),
  ],
  styleUrl: './recipe-message.component.css',
  template: `
    <div class="rounded-lg border border-border bg-card overflow-hidden max-w-full">
      <div
        class="flex items-center justify-between gap-2 px-3 py-2 bg-muted/50 border-b border-border cursor-pointer"
        (click)="onActivateClick($event)"
      >
        <div class="flex items-center gap-2 min-w-0">
          @if (recipeContext().isActive) {
            <hlm-badge variant="default" class="shrink-0">
              <ng-icon hlm name="heroEye" class="size-3 mr-1" />
              Active
            </hlm-badge>
          }
          @if (recipeContext().modifiedRecipe) {
            <hlm-badge variant="secondary" class="shrink-0">
              <ng-icon hlm name="heroSparkles" class="size-3 mr-1 text-primary" />
              Modified
            </hlm-badge>
          }
          <span class="text-sm font-medium truncate">
            {{ recipeContext().originalRecipe.title }}
          </span>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <button
            hlmBtn
            variant="ghost"
            size="icon"
            type="button"
            [attr.aria-label]="isExpanded() ? 'Collapse recipe' : 'Expand recipe'"
            class="size-7"
            (click)="onToggleExpand($event)"
          >
            <ng-icon
              hlm
              [name]="isExpanded() ? 'heroChevronUp' : 'heroChevronDown'"
              class="size-4"
            />
          </button>
          <button
            hlmBtn
            variant="ghost"
            size="icon"
            type="button"
            aria-label="Open recipe in split view"
            class="size-7"
            (click)="onFullscreenClick($event)"
          >
            <ng-icon hlm name="heroArrowsPointingOut" class="size-4" />
          </button>
          <button
            hlmBtn
            variant="ghost"
            size="icon"
            type="button"
            aria-label="Close recipe"
            class="size-7 text-muted-foreground md:hover:text-destructive"
            (click)="onCloseClick($event)"
          >
            <ng-icon hlm name="heroXMark" class="size-4" />
          </button>
        </div>
      </div>

      @if (isExpanded()) {
        <div class="recipe-detail-wrapper p-3">
          <app-recipe-detail-view
            data-testid="chat-recipe-detail"
            class="recipe-detail-view-container"
            [recipe]="recipeContext().originalRecipe"
            [modifiedRecipe]="recipeContext().modifiedRecipe ?? null"
            [isOwner]="true"
            [isEditing]="recipeContext().isEditing"
            [variant]="'inline'"
            [(viewMode)]="viewMode"
            [autoSwitchToChanges]="recipeContext().startInModifiedMode ?? false"
            (editClick)="editClick.emit()"
            (saveClick)="saveEditClick.emit($event)"
            (cancelEditClick)="cancelEditClick.emit()"
          />
        </div>
      } @else {
        <div
          class="px-3 py-2 text-sm text-muted-foreground cursor-pointer"
          (click)="onActivateClick($event)"
        >
          <span class="font-medium text-foreground">
            {{ recipeContext().originalRecipe.difficulty | titlecase }}
          </span>
          · {{ recipeContext().originalRecipe.durationMinutes }} min ·
          {{ recipeContext().originalRecipe.servings }} servings
          @if (recipeContext().originalRecipe.spiceLevel > 0) {
            · 🌶️ {{ recipeContext().originalRecipe.spiceLevel }}
          }
        </div>
      }

      @if (isExpanded() && isShowingChanges()) {
        <div
          class="flex items-center justify-end gap-2 px-3 py-2 border-t border-border bg-muted/20"
        >
          <button hlmBtn variant="ghost" size="sm" type="button" (click)="onDismissChanges($event)">
            Dismiss Changes
          </button>
          <button hlmBtn variant="default" size="sm" type="button" (click)="onSaveAsCopy($event)">
            <ng-icon hlm name="heroDocumentDuplicate" class="size-3.5 mr-1" />
            Save as Copy
          </button>
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeMessageComponent {
  readonly recipeContext = input.required<RecipeContext>();

  readonly collapseClick = output<void>();
  readonly closeClick = output<void>();
  readonly editClick = output<void>();
  readonly saveClick = output<void>();
  readonly saveEditClick = output<RecipePatchRequest>();
  readonly cancelEditClick = output<void>();
  readonly activateClick = output<void>();
  readonly saveAsCopyClick = output<RecipeResponse>();
  readonly dismissChangesClick = output<void>();
  readonly fullscreenClick = output<void>();

  readonly isExpanded = signal(true);
  readonly viewMode = signal<'original' | 'modified'>('original');

  readonly hasModified = computed(() => !!this.recipeContext().modifiedRecipe);

  readonly isShowingChanges = computed(() => this.viewMode() === 'modified' && this.hasModified());

  constructor() {
    effect(() => {
      if (this.recipeContext().startInModifiedMode && this.hasModified()) {
        this.viewMode.set('modified');
      }
    });

    effect(() => {
      if (!this.recipeContext().isActive && this.isExpanded()) {
        this.isExpanded.set(false);
      }
    });

    effect(() => {
      if (this.recipeContext().isActive && !this.isExpanded()) {
        this.isExpanded.set(true);
      }
    });
  }

  onToggleExpand(event: Event): void {
    event.stopPropagation();
    this.isExpanded.update((v) => !v);
    if (this.isExpanded()) {
      this.activateClick.emit();
    } else {
      this.collapseClick.emit();
    }
  }

  onCloseClick(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    this.closeClick.emit();
  }

  onActivateClick(event: Event): void {
    event.stopPropagation();
    this.activateClick.emit();
  }

  onFullscreenClick(event: Event): void {
    event.stopPropagation();
    this.fullscreenClick.emit();
  }

  onSaveAsCopy(event: Event): void {
    event.stopPropagation();
    const modified = this.recipeContext().modifiedRecipe;
    if (modified) {
      this.saveAsCopyClick.emit(modified);
    }
  }

  onDismissChanges(event: Event): void {
    event.stopPropagation();
    this.dismissChangesClick.emit();
    this.viewMode.set('original');
  }
}
