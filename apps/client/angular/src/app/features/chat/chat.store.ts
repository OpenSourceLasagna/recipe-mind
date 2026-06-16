import { computed, Injectable, signal } from '@angular/core';
import { ChatMessage, RecipeContext } from './models/chat-message.model';
import { RecipeCardDto } from '../dashboard/models/recipe-card.dto';
import { RecipeResponse } from '../dashboard/models/recipe.model';

@Injectable({ providedIn: 'root' })
export class ChatStore {
  readonly #messages = signal<ChatMessage[]>([]);
  readonly #isOpen = signal(false);
  readonly #isLoading = signal(false);
  readonly #nextMessageId = signal(0);
  readonly #aiResults = signal<RecipeCardDto[] | null>(null);
  readonly #activeRecipeId = signal<string | null>(null);
  readonly #contextRecipeId = signal<string | null>(null);
  readonly #contextExcluded = signal(false);

  readonly messages = this.#messages.asReadonly();
  readonly isOpen = this.#isOpen.asReadonly();
  readonly isLoading = this.#isLoading.asReadonly();
  readonly hasMessages = computed(() => this.#messages().length > 0);
  readonly aiResults = this.#aiResults.asReadonly();
  readonly hasAiResults = computed(() => (this.#aiResults()?.length ?? 0) > 0);
  readonly activeRecipeId = this.#activeRecipeId.asReadonly();
  readonly contextRecipeId = this.#contextRecipeId.asReadonly();
  readonly contextExcluded = this.#contextExcluded.asReadonly();
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

  setAiResults(recipes: RecipeCardDto[]): void {
    this.#aiResults.set(recipes);
  }

  clearAiResults(): void {
    this.#aiResults.set(null);
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

  expandRecipe(
    originalRecipe: RecipeResponse,
    modifiedRecipe?: RecipeResponse,
    changedFields?: string[],
  ): void {
    const recipeContext: RecipeContext = {
      originalRecipe,
      modifiedRecipe,
      changedFields,
      isActive: true,
      isEditing: false,
    };

    this.addMessage({
      role: 'recipe',
      content: '',
      recipeContext,
    });

    this.setActiveRecipe(originalRecipe.id);
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
      const lastExpanded = [...this.#messages()]
        .reverse()
        .find((m) => m.role === 'recipe' && m.recipeContext?.isActive);

      this.setActiveRecipe(lastExpanded?.recipeContext?.originalRecipe.id ?? null);
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

  reset(): void {
    this.#messages.set([]);
    this.#isLoading.set(false);
    this.#nextMessageId.set(0);
    this.#aiResults.set(null);
    this.#activeRecipeId.set(null);
    this.#contextRecipeId.set(null);
    this.#contextExcluded.set(false);
  }
}
