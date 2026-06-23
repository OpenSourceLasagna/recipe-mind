import {
  ChangeDetectionStrategy,
  Component,
  computed,
  HostListener,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { RecipeDetailViewComponent } from '../../../dashboard/components/recipe-detail-view/recipe-detail-view.component';
import { RecipeContext } from '../../models/chat-message.model';
import { ChatStore } from '../../chat.store';

@Component({
  selector: 'app-recipe-overlay',
  standalone: true,
  imports: [RecipeDetailViewComponent],
  template: `
    <app-recipe-detail-view
      variant="page"
      [showChatButton]="false"
      [recipe]="recipeContext().originalRecipe"
      [modifiedRecipe]="recipeContext().modifiedRecipe ?? null"
      [isOwner]="true"
      [isEditing]="recipeContext().isEditing"
      [autoSwitchToChanges]="recipeContext().startInModifiedMode ?? false"
      [(viewMode)]="viewMode"
      (backClick)="onClose()"
      (editClick)="onEdit()"
      (saveClick)="onSave($event)"
      (cancelEditClick)="onCancelEdit()"
      (saveAsCopyClick)="onSaveAsCopy($event)"
      (dismissChangesClick)="onDismissChanges()"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeOverlayComponent {
  readonly recipeContext = input.required<RecipeContext>();
  readonly overlayClose = output<void>();

  readonly viewMode = signal<'original' | 'modified'>('original');

  private readonly store = inject(ChatStore);

  private readonly messageId = computed(() =>
    this.store.findRecipeMessageId(this.recipeContext().originalRecipe.id)!,
  );

  @HostListener('document:keydown.escape')
  onKeydownHandler(): void {
    this.onClose();
  }

  onClose(): void {
    this.overlayClose.emit();
  }

  onEdit(): void {
    this.store.setRecipeEditing(this.messageId(), true);
  }

  onSave(_patch: unknown): void {
    this.store.setRecipeEditing(this.messageId(), false);
  }

  onCancelEdit(): void {
    this.store.setRecipeEditing(this.messageId(), false);
  }

  onSaveAsCopy(_modified: unknown): void {
    // no-op: matches existing chat-panel behavior
  }

  onDismissChanges(): void {
    this.store.dismissRecipeChanges(this.messageId());
  }
}
