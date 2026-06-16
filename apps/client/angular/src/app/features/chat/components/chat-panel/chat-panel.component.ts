import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  model,
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
import { RecipeResponse } from '../../../dashboard/models/recipe.model';
import { RecipeDetailService } from '../../../dashboard/services/recipe-detail.service';
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
  ],
  providers: [provideIcons({ heroXMark, heroSparkles, heroPaperAirplane })],
  templateUrl: './chat-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatPanelComponent {
  readonly store = inject(ChatStore);
  readonly #service = inject(ChatService);
  readonly #detailService = inject(RecipeDetailService);

  readonly inputValue = model('');

  readonly canSend = computed(() => this.inputValue().trim().length > 0 && !this.store.isLoading());

  readonly scrollContainer = viewChild.required<ElementRef<HTMLDivElement>>('scrollContainer');

  readonly #history = this.store.messages;
  readonly #pendingMessage = this.#service.stream.value;
  readonly #storeLoading = this.store.isLoading;

  readonly contextRecipeId = this.store.contextRecipeId;
  readonly contextExcluded = this.store.contextExcluded;

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
      const confirmed = confirm(
        'You have unsaved recipe changes. Are you sure you want to close the chat?',
      );
      if (!confirmed) return;
    }
    this.store.close();
  }

  toggleContextExcluded(): void {
    this.store.toggleContextExcluded();
  }

  expandContextRecipe(): void {
    const recipeId = this.contextRecipeId();
    if (!recipeId) return;

    const recipe = this.#detailService.recipe.value();
    if (!recipe) return;

    const originalRecipe = recipe as unknown as RecipeResponse;
    const modifiedRecipe = recipe.modifiedRecipe as unknown as RecipeResponse | undefined;

    this.store.expandRecipe(originalRecipe, modifiedRecipe);
  }

  onRecipeCardExpand(recipe: RecipeResponse): void {
    this.store.expandRecipe(recipe);
  }

  onCollapseClick(messageId: number): void {
    this.store.collapseRecipe(messageId);
  }

  onCloseClick(messageId: number): void {
    this.store.collapseRecipe(messageId);
  }

  onEditClick(messageId: number): void {
    this.store.setRecipeEditing(messageId, true);
  }

  onSaveClick(_messageId: number): void {
    // TODO: Implement save as new recipe functionality
  }

  onSaveEditClick(event: { messageId: number; patch: RecipePatchRequest }): void {
    // TODO: Implement save edit functionality
    this.store.setRecipeEditing(event.messageId, false);
  }

  onCancelEditClick(messageId: number): void {
    this.store.setRecipeEditing(messageId, false);
  }

  private scrollToBottom(): void {
    const el = this.scrollContainer().nativeElement;
    el.scrollTop = el.scrollHeight;
  }
}
