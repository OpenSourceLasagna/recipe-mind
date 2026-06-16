import { computed, Injectable, signal } from '@angular/core';
import { ChatMessage } from './models/chat-message.model';

@Injectable({ providedIn: 'root' })
export class ChatStore {
  readonly #messages = signal<ChatMessage[]>([]);
  readonly #isOpen = signal(false);
  readonly #isLoading = signal(false);
  readonly #nextMessageId = signal(0);

  readonly messages = this.#messages.asReadonly();
  readonly isOpen = this.#isOpen.asReadonly();
  readonly isLoading = this.#isLoading.asReadonly();
  readonly hasMessages = computed(() => this.#messages().length > 0);

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

  reset(): void {
    this.#messages.set([]);
    this.#isLoading.set(false);
    this.#nextMessageId.set(0);
  }
}
