import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  heroChevronDown,
  heroChevronUp,
  heroEye,
  heroPencil,
  heroSparkles,
  heroXMark,
} from '@ng-icons/heroicons/outline';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { TitleCasePipe } from '@angular/common';
import { RecipeDetailViewComponent } from '../../../dashboard/components/recipe-detail-view/recipe-detail-view.component';
import { RecipeContext } from '../../models/chat-message.model';
import { RecipePatchRequest } from '../../../dashboard/models/recipe-edit.model';

@Component({
  selector: 'app-recipe-message',
  standalone: true,
  imports: [NgIcon, HlmButton, HlmBadge, RecipeDetailViewComponent, TitleCasePipe],
  providers: [
    provideIcons({
      heroChevronDown,
      heroChevronUp,
      heroEye,
      heroPencil,
      heroSparkles,
      heroXMark,
    }),
  ],
  styleUrl: './recipe-message.component.css',
  template: `
    <div class="rounded-lg border border-border bg-card overflow-hidden max-w-full">
      <!-- Header -->
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
            aria-label="Save recipe"
            class="size-7 text-muted-foreground md:hover:text-primary"
            (click)="onSaveClick($event)"
          >
            <ng-icon hlm name="heroSparkles" class="size-4" />
          </button>
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
            aria-label="Close recipe"
            class="size-7 text-muted-foreground md:hover:text-destructive"
            (click)="onCloseClick($event)"
          >
            <ng-icon hlm name="heroXMark" class="size-4" />
          </button>
        </div>
      </div>

      <!-- Content -->
      @if (isExpanded()) {
        <div class="recipe-detail-wrapper p-3">
          <app-recipe-detail-view
            class="recipe-detail-view-container"
            [recipe]="recipeContext().originalRecipe"
            [modifiedRecipe]="recipeContext().modifiedRecipe ?? null"
            [isOwner]="true"
            [isEditing]="recipeContext().isEditing"
            [(viewMode)]="viewMode"
            (editClick)="editClick.emit()"
            (saveClick)="saveEditClick.emit($event)"
            (cancelEditClick)="cancelEditClick.emit()"
          />
        </div>
      } @else {
        <!-- Collapsed preview -->
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

  readonly isExpanded = signal(true);
  readonly viewMode = signal<'original' | 'modified'>('original');

  readonly hasModified = computed(() => !!this.recipeContext().modifiedRecipe);

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

  onSaveClick(event: Event): void {
    event.stopPropagation();
    this.saveClick.emit();
  }
}
