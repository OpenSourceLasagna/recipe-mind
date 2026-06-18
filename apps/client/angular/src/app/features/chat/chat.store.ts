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
  readonly #focusedMessageId = signal<number | null>(null);

  readonly messages = this.#messages.asReadonly();
  readonly isOpen = this.#isOpen.asReadonly();
  readonly isLoading = this.#isLoading.asReadonly();
  readonly hasMessages = computed(() => this.#messages().length > 0);
  readonly aiResults = this.#aiResults.asReadonly();
  readonly hasAiResults = computed(() => (this.#aiResults()?.length ?? 0) > 0);
  readonly activeRecipeId = this.#activeRecipeId.asReadonly();
  readonly contextRecipeId = this.#contextRecipeId.asReadonly();
  readonly contextExcluded = this.#contextExcluded.asReadonly();
  readonly focusedMessageId = this.#focusedMessageId.asReadonly();
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
    };

    this.addMessage({
      role: 'recipe',
      content: '',
      recipeContext,
    });

    this.setActiveRecipe(originalRecipe.id);
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

  removeAllRecipeMessages(): RecipeCardDto[] {
    const recipeMessages = this.#messages().filter(
      (msg) => msg.role === 'recipe' && msg.recipeContext,
    );

    const cardDtos: RecipeCardDto[] = recipeMessages.map((msg) => {
      const recipe = msg.recipeContext!.originalRecipe;
      return {
        id: recipe.id,
        title: recipe.title,
        difficulty: recipe.difficulty,
        spice_level: recipe.spiceLevel,
        durationMinutes: recipe.durationMinutes,
        servings: recipe.servings,
      };
    });

    this.#messages.update((msgs) => msgs.filter((msg) => msg.role !== 'recipe'));
    this.setActiveRecipe(null);

    return cardDtos;
  }

  extractRecipeCardDtos(): RecipeCardDto[] {
    return this.#messages()
      .filter((msg) => msg.role === 'recipe' && msg.recipeContext)
      .map((msg) => {
        const recipe = msg.recipeContext!.originalRecipe;
        return {
          id: recipe.id,
          title: recipe.title,
          difficulty: recipe.difficulty,
          spice_level: recipe.spiceLevel,
          durationMinutes: recipe.durationMinutes,
          servings: recipe.servings,
        };
      });
  }

  findFirstRecipeMessageId(): number | null {
    const first = this.#messages().find((msg) => msg.role === 'recipe' && msg.recipeContext);
    return first?.id ?? null;
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

  reset(): void {
    this.#messages.set([]);
    this.#isLoading.set(false);
    this.#nextMessageId.set(0);
    this.#aiResults.set(null);
    this.#activeRecipeId.set(null);
    this.#contextRecipeId.set(null);
    this.#contextExcluded.set(false);
    this.#focusedMessageId.set(null);
  }
}
