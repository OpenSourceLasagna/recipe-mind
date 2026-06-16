import { computed, Injectable, signal } from '@angular/core';
import { ChatMessage } from './models/chat-message.model';
import { RecipeCardDto } from '../dashboard/models/recipe-card.dto';

@Injectable({ providedIn: 'root' })
export class ChatStore {
  readonly #messages = signal<ChatMessage[]>([]);
  readonly #isOpen = signal(false);
  readonly #isLoading = signal(false);
  readonly #nextMessageId = signal(0);
  readonly #aiResults = signal<RecipeCardDto[] | null>(null);

  readonly messages = this.#messages.asReadonly();
  readonly isOpen = this.#isOpen.asReadonly();
  readonly isLoading = this.#isLoading.asReadonly();
  readonly hasMessages = computed(() => this.#messages().length > 0);
  readonly aiResults = this.#aiResults.asReadonly();
  readonly hasAiResults = computed(() => (this.#aiResults()?.length ?? 0) > 0);

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

  reset(): void {
    this.#messages.set([]);
    this.#isLoading.set(false);
    this.#nextMessageId.set(0);
    this.#aiResults.set(null);
  }
}
