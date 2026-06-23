import { computed, Injectable, signal } from '@angular/core';
import { ChatMessage, RecipeContext } from './models/chat-message.model';
import { RecipeResponse } from '../dashboard/models/recipe.model';

@Injectable({ providedIn: 'root' })
export class ChatStore {
  readonly #messages = signal<ChatMessage[]>([]);
  readonly #isOpen = signal(false);
  readonly #isLoading = signal(false);
  readonly #nextMessageId = signal(0);
  readonly #activeRecipeId = signal<string | null>(null);
  readonly #contextRecipeId = signal<string | null>(null);
  readonly #contextExcluded = signal(false);
  readonly #focusedMessageId = signal<number | null>(null);
  readonly #fullscreenSourceMessageId = signal<number | null>(null);
  readonly #aiDrafts = signal<Record<string, { draft: RecipeResponse; changedFields: string[] }>>(
    {},
  );
  readonly #draftNotificationCount = signal(0);

  readonly messages = this.#messages.asReadonly();
  readonly isOpen = this.#isOpen.asReadonly();
  readonly isLoading = this.#isLoading.asReadonly();
  readonly hasMessages = computed(() => this.#messages().length > 0);
  readonly activeRecipeId = this.#activeRecipeId.asReadonly();
  readonly contextRecipeId = this.#contextRecipeId.asReadonly();
  readonly contextExcluded = this.#contextExcluded.asReadonly();
  readonly focusedMessageId = this.#focusedMessageId.asReadonly();
  readonly aiDrafts = this.#aiDrafts.asReadonly();
  readonly draftNotificationCount = this.#draftNotificationCount.asReadonly();
  readonly fullscreenSourceMessageId = this.#fullscreenSourceMessageId.asReadonly();
  readonly fullscreenRecipeContext = computed(() => {
    const messageId = this.#fullscreenSourceMessageId();
    if (messageId === null) return null;
    const message = this.#messages().find(m => m.id === messageId);
    return message?.recipeContext ?? null;
  });
  readonly effectiveContextRecipeId = computed(() => {
    if (this.#contextRecipeId() && !this.#contextExcluded()) {
      return this.#contextRecipeId();
    }
    return this.#activeRecipeId();
  });

  addMessage(message: Omit<ChatMessage, 'id'>): void {
    this.#messages.update((msgs) => [...msgs, { ...message, id: this.#nextMessageId() }]);
    this.#nextMessageId.update((i) => i + 1);
  }

  updateLastAssistantMessage(content: string): void {
    this.#messages.update((msgs) => {
      const idx = msgs.length - 1;
      if (idx < 0 || msgs[idx].role !== 'assistant') return msgs;
      return [...msgs.slice(0, idx), { ...msgs[idx], content }];
    });
  }

  setLoading(loading: boolean): void {
    this.#isLoading.set(loading);
  }

  toggle(): void {
    this.#isOpen.update((open) => !open);
  }

  open(): void {
    this.#isOpen.set(true);
  }

  close(): void {
    this.#isOpen.set(false);
  }

  setContextRecipe(recipeId: string | null): void {
    this.#contextRecipeId.set(recipeId);
    this.#contextExcluded.set(false);
  }

  toggleContextExcluded(): void {
    this.#contextExcluded.update((excluded) => !excluded);
  }

  setActiveRecipe(recipeId: string | null): void {
    this.#activeRecipeId.set(recipeId);
  }

  isRecipeExpanded(recipeId: string): boolean {
    return this.#messages().some(
      (msg) => msg.role === 'recipe' && msg.recipeContext?.originalRecipe.id === recipeId,
    );
  }

  findRecipeMessageId(recipeId: string): number | null {
    const message = this.#messages().find(
      (msg) => msg.role === 'recipe' && msg.recipeContext?.originalRecipe.id === recipeId,
    );
    return message?.id ?? null;
  }

  expandRecipe(
    originalRecipe: RecipeResponse,
    modifiedRecipe?: RecipeResponse,
    changedFields?: string[],
    startInModifiedMode = false,
  ): void {
    if (this.isRecipeExpanded(originalRecipe.id)) {
      return;
    }

    this.#deactivateAllRecipes();

    const recipeContext: RecipeContext = {
      originalRecipe,
      modifiedRecipe,
      changedFields,
      isActive: true,
      isEditing: false,
      startInModifiedMode,
    };

    this.addMessage({
      role: 'recipe',
      content: '',
      recipeContext,
    });

    this.setActiveRecipe(originalRecipe.id);
  }

  moveRecipeMessageToBottom(messageId: number): void {
    this.#messages.update((msgs) => {
      const idx = msgs.findIndex((m) => m.id === messageId);
      if (idx < 0) return msgs;
      const msg = msgs[idx];
      const without = [...msgs.slice(0, idx), ...msgs.slice(idx + 1)];
      return [...without, msg];
    });
  }

  updateRecipeMessageDraft(
    recipeId: string,
    draft: RecipeResponse,
    changedFields: string[],
  ): void {
    this.#deactivateAllRecipes();
    this.#messages.update((msgs) =>
      msgs.map((msg) => {
        if (msg.role === 'recipe' && msg.recipeContext?.originalRecipe.id === recipeId) {
          return {
            ...msg,
            recipeContext: {
              ...msg.recipeContext,
              modifiedRecipe: draft,
              changedFields,
              isActive: true,
              startInModifiedMode: true,
            },
          };
        }
        return msg;
      }),
    );
    this.setActiveRecipe(recipeId);
  }

  activateRecipeMessage(messageId: number): void {
    this.#deactivateAllRecipes();
    this.#messages.update((msgs) =>
      msgs.map((msg) => {
        if (msg.id === messageId && msg.recipeContext) {
          return {
            ...msg,
            recipeContext: { ...msg.recipeContext, isActive: true },
          };
        }
        return msg;
      }),
    );
    const activated = this.#messages().find((m) => m.id === messageId);
    this.setActiveRecipe(activated?.recipeContext?.originalRecipe.id ?? null);
  }

  removeRecipeMessage(messageId: number): void {
    const message = this.#messages().find((msg) => msg.id === messageId);

    if (message?.role === 'recipe' && message.recipeContext) {
      this.#updateActiveAfterRemoval(message);
    }

    this.#messages.update((msgs) => msgs.filter((msg) => msg.id !== messageId));
  }

  #updateActiveAfterRemoval(message: ChatMessage): void {
    const removedRecipeId = message.recipeContext!.originalRecipe.id;

    if (this.#activeRecipeId() !== removedRecipeId) {
      return;
    }

    const next = [...this.#messages()]
      .reverse()
      .find(
        (msg) => msg.id !== message.id && msg.role === 'recipe' && msg.recipeContext !== undefined,
      );

    if (next) {
      this.activateRecipeMessage(next.id);
    } else {
      this.setActiveRecipe(null);
    }
  }

  #deactivateAllRecipes(): void {
    this.#messages.update((msgs) =>
      msgs.map((msg) => {
        if (msg.role === 'recipe' && msg.recipeContext?.isActive) {
          return {
            ...msg,
            recipeContext: { ...msg.recipeContext, isActive: false },
          };
        }
        return msg;
      }),
    );
  }

  focusRecipeMessage(messageId: number): void {
    this.#focusedMessageId.set(messageId);
  }

  clearFocusedMessage(): void {
    this.#focusedMessageId.set(null);
  }

  collapseRecipe(messageId: number): void {
    this.#messages.update((msgs) =>
      msgs.map((msg) => {
        if (msg.id === messageId && msg.recipeContext) {
          return {
            ...msg,
            recipeContext: { ...msg.recipeContext, isActive: false },
          };
        }
        return msg;
      }),
    );

    const collapsedMessage = this.#messages().find((m) => m.id === messageId);
    if (collapsedMessage?.recipeContext?.originalRecipe.id === this.#activeRecipeId()) {
      const next = [...this.#messages()]
        .reverse()
        .find((m) => m.id !== messageId && m.role === 'recipe' && m.recipeContext !== undefined);

      if (next) {
        this.activateRecipeMessage(next.id);
      } else {
        this.setActiveRecipe(null);
      }
    }
  }

  setRecipeEditing(messageId: number, isEditing: boolean): void {
    this.#messages.update((msgs) =>
      msgs.map((msg) => {
        if (msg.id === messageId && msg.recipeContext) {
          return {
            ...msg,
            recipeContext: { ...msg.recipeContext, isEditing },
          };
        }
        return msg;
      }),
    );
  }

  hasUnsavedRecipeChanges(): boolean {
    return this.#messages().some(
      (msg) =>
        msg.role === 'recipe' &&
        msg.recipeContext &&
        (msg.recipeContext.modifiedRecipe !== undefined || msg.recipeContext.isEditing),
    );
  }

  setAiDraft(recipeId: string, draft: RecipeResponse, changedFields: string[]): void {
    this.#aiDrafts.update((drafts) => ({ ...drafts, [recipeId]: { draft, changedFields } }));
    this.#draftNotificationCount.update((c) => c + 1);
  }

  getAiDraft(
    recipeId: string,
  ): { draft: RecipeResponse; changedFields: string[] } | null {
    return this.#aiDrafts()[recipeId] ?? null;
  }

  clearAiDraft(recipeId: string): void {
    this.#aiDrafts.update((drafts) => {
      if (!(recipeId in drafts)) return drafts;
      const next = { ...drafts };
      delete next[recipeId];
      return next;
    });
  }

  consumeAiDraft(
    recipeId: string,
  ): { draft: RecipeResponse; changedFields: string[] } | null {
    const draft = this.getAiDraft(recipeId);
    if (draft) {
      this.clearAiDraft(recipeId);
    }
    return draft;
  }

  acknowledgeDraftProcessed(): void {
    this.#draftNotificationCount.update((c) => Math.max(0, c - 1));
  }

  processPendingDrafts(contextRecipe: RecipeResponse | null): void {
    const count = this.#draftNotificationCount();
    if (count === 0) return;

    const drafts = this.#aiDrafts();
    const draftEntries = Object.entries(drafts);
    if (draftEntries.length === 0) return;

    for (const [recipeId, draftData] of draftEntries) {
      const existingMessageId = this.findRecipeMessageId(recipeId);

      if (existingMessageId !== null) {
        this.updateRecipeMessageDraft(
          recipeId,
          draftData.draft,
          draftData.changedFields,
        );
        this.moveRecipeMessageToBottom(existingMessageId);
        this.focusRecipeMessage(existingMessageId);
        this.openFullscreenRecipe(existingMessageId);
      } else if (contextRecipe && contextRecipe.id === recipeId) {
        this.expandRecipe(
          contextRecipe,
          draftData.draft,
          draftData.changedFields,
          true,
        );
        const newMessageId = this.findRecipeMessageId(recipeId);
        if (newMessageId !== null) {
          this.focusRecipeMessage(newMessageId);
          this.openFullscreenRecipe(newMessageId);
        }
      }

      this.clearAiDraft(recipeId);
      this.acknowledgeDraftProcessed();
    }
  }

  dismissRecipeChanges(messageId: number): void {
    this.#messages.update((msgs) =>
      msgs.map((msg) => {
        if (msg.id === messageId && msg.recipeContext) {
          return {
            ...msg,
            recipeContext: {
              ...msg.recipeContext,
              modifiedRecipe: undefined,
              changedFields: undefined,
            },
          };
        }
        return msg;
      }),
    );
  }

  openFullscreenRecipe(messageId: number): void {
    const message = this.#messages().find((m) => m.id === messageId);
    if (!message?.recipeContext) return;

    this.#fullscreenSourceMessageId.set(messageId);

    this.#messages.update((msgs) =>
      msgs.map((msg) => {
        if (msg.id === messageId && msg.recipeContext) {
          return {
            ...msg,
            recipeContext: { ...msg.recipeContext, isActive: false },
          };
        }
        return msg;
      }),
    );
  }

  closeFullscreenRecipe(): void {
    const messageId = this.#fullscreenSourceMessageId();
    this.#fullscreenSourceMessageId.set(null);

    if (messageId !== null) {
      this.activateRecipeMessage(messageId);
      this.focusRecipeMessage(messageId);
    }
  }

  reset(): void {
    this.#messages.set([]);
    this.#isLoading.set(false);
    this.#nextMessageId.set(0);
    this.#activeRecipeId.set(null);
    this.#contextRecipeId.set(null);
    this.#contextExcluded.set(false);
    this.#focusedMessageId.set(null);
    this.#fullscreenSourceMessageId.set(null);
    this.#aiDrafts.set({});
    this.#draftNotificationCount.set(0);
  }
}
