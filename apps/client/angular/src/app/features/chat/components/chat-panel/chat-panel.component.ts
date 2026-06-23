import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  model,
  signal,
  Signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroPaperAirplane, heroSparkles, heroXMark } from '@ng-icons/heroicons/outline';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { ChatStore } from '../../chat.store';
import { ChatService } from '../../chat.service';
import { ChatMessageComponent } from '../chat-message/chat-message.component';
import { PanelChatMessage } from '../../models/chat-message.model';
import { ContextRecipeCardComponent } from '../context-recipe-card/context-recipe-card.component';
import { RecipeOverlayComponent } from '../recipe-overlay/recipe-overlay.component';
import { RecipeResponse } from '../../../dashboard/models/recipe.model';
import { RecipeDetailService } from '../../../dashboard/services/recipe-detail.service';
import { RecipeFilterService } from '../../../dashboard/services/recipe-filter.service';
import { RecipePatchRequest } from '../../../dashboard/models/recipe-edit.model';

@Component({
  selector: 'app-chat-panel',
  standalone: true,
  imports: [
    FormsModule,
    HlmButton,
    HlmInput,
    NgIcon,
    ChatMessageComponent,
    ContextRecipeCardComponent,
    RecipeOverlayComponent,
  ],
  providers: [provideIcons({ heroXMark, heroSparkles, heroPaperAirplane })],
  templateUrl: './chat-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatPanelComponent {
  readonly store = inject(ChatStore);
  readonly #service = inject(ChatService);
  readonly #detailService = inject(RecipeDetailService);
  readonly #filterService = inject(RecipeFilterService);

  readonly fullscreenRecipeContext = this.store.fullscreenRecipeContext;
  readonly isDesktop = this.#filterService.isDesktop;

  readonly showCloseConfirm = signal(false);

  readonly inputValue = model('');

  readonly canSend = computed(() => this.inputValue().trim().length > 0 && !this.store.isLoading());

  readonly scrollContainer = viewChild.required<ElementRef<HTMLDivElement>>('scrollContainer');

  readonly #history = this.store.messages;
  readonly #pendingMessage = this.#service.stream.value;
  readonly #storeLoading = this.store.isLoading;

  readonly contextRecipeId = this.store.contextRecipeId;
  readonly contextExcluded = this.store.contextExcluded;
  readonly focusedMessageId = this.store.focusedMessageId;

  readonly loadingStatus = computed<{ isLoading: boolean; message?: string }>(() => {
    const status = this.#pendingMessage()?.status;
    if (status != null) {
      return {
        isLoading: true,
        message:
          `${status.status.toLocaleUpperCase()}: ${status.detail ?? 'working in the kitchen'}`.trim(),
      };
    }
    return { isLoading: this.#storeLoading() };
  });

  readonly messages = computed(() => {
    const messages: PanelChatMessage[] = [...(this.#history() ?? [])];
    const pendingMessage = this.#pendingMessage()?.message;
    if (pendingMessage != undefined && (pendingMessage.content?.length ?? 0) > 0) {
      messages.push({
        ...pendingMessage,
        role: 'assistant',
        id: Number.POSITIVE_INFINITY,
        isPending: true,
      });
    }
    return messages;
  });

  constructor() {
    effect(() => {
      const _msgs = this.store.messages();
      const _loading = this.store.isLoading();
      untracked(() => this.scrollToBottom());
    });

    effect(() => {
      const focusedId = this.focusedMessageId();
      if (focusedId !== null) {
        untracked(() => this.scrollToMessage(focusedId));
      }
    });

    effect(() => {
      const count = this.store.draftNotificationCount();
      if (count === 0) return;
      const contextRecipe = untracked(() => this.#detailService.recipe.value());
      untracked(() => this.store.processPendingDrafts(contextRecipe ?? null));
    });

    effect(() => {
      if (!this.store.isOpen() && this.store.fullscreenRecipeContext()) {
        this.store.closeFullscreenRecipe();
      }
    });
  }

  send(event: Event): void {
    event.preventDefault();
    const text = this.inputValue().trim();
    if (!text || this.store.isLoading()) return;

    this.inputValue.set('');
    this.#service.sendMessage(text);
  }

  close(): void {
    if (this.store.hasUnsavedRecipeChanges()) {
      this.showCloseConfirm.set(true);
      return;
    }
    this.store.close();
  }

  confirmClose(): void {
    this.showCloseConfirm.set(false);
    this.store.close();
  }

  cancelClose(): void {
    this.showCloseConfirm.set(false);
  }

  toggleContextExcluded(): void {
    this.store.toggleContextExcluded();
  }

  expandContextRecipe(): void {
    const recipeId = this.contextRecipeId();
    if (!recipeId) return;

    const existingMessageId = this.store.findRecipeMessageId(recipeId);
    if (existingMessageId !== null) {
      this.store.activateRecipeMessage(existingMessageId);
      this.store.focusRecipeMessage(existingMessageId);
      return;
    }
    untracked(() => {
      const recipe = this.#detailService.recipe.value();
      if (!recipe) return;

      this.store.expandRecipe(
        recipe as unknown as RecipeResponse,
        recipe.modifiedRecipe as unknown as RecipeResponse | undefined,
      );
      const newMessageId = this.store.findRecipeMessageId(recipeId);
      if (newMessageId !== null) {
        this.store.focusRecipeMessage(newMessageId);
      }
    });
  }

  onRecipeCardExpand(recipe: RecipeResponse): void {
    const existingMessageId = this.store.findRecipeMessageId(recipe.id);
    if (existingMessageId !== null) {
      this.store.activateRecipeMessage(existingMessageId);
      this.store.focusRecipeMessage(existingMessageId);
      return;
    }

    untracked(() => {
      this.store.expandRecipe(recipe);
      const newMessageId = this.store.findRecipeMessageId(recipe.id);
      if (newMessageId !== null) {
        this.store.focusRecipeMessage(newMessageId);
      }
    });
  }

  onCollapseClick(messageId: number): void {
    this.store.collapseRecipe(messageId);
  }

  onCloseClick(messageId: number): void {
    this.store.removeRecipeMessage(messageId);
  }

  onEditClick(messageId: number): void {
    this.store.setRecipeEditing(messageId, true);
  }

  onSaveAsCopyClick(event: { messageId: number; modifiedRecipe: RecipeResponse }): void {}

  onDismissChangesClick(messageId: number): void {
    this.store.dismissRecipeChanges(messageId);
  }

  onSaveEditClick(event: { messageId: number; patch: RecipePatchRequest }): void {
    this.store.setRecipeEditing(event.messageId, false);
  }

  onCancelEditClick(messageId: number): void {
    this.store.setRecipeEditing(messageId, false);
  }

  onActivateClick(messageId: number): void {
    this.store.activateRecipeMessage(messageId);
  }

  onHighlightEnd(): void {
    this.store.clearFocusedMessage();
  }

  onRecipeOverlayClose(): void {
    this.store.closeFullscreenRecipe();
  }

  onRecipeFullscreenClick(messageId: number): void {
    this.store.openFullscreenRecipe(messageId);
  }

  private scrollToBottom(): void {
    const el = this.scrollContainer().nativeElement;
    el.scrollTop = el.scrollHeight;
  }

  private scrollToMessage(messageId: number): void {
    const el = this.scrollContainer().nativeElement;
    const messageElement = el.querySelector(`[data-message-id="${messageId}"]`);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
}
