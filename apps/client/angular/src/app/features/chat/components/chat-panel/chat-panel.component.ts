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

@Component({
  selector: 'app-chat-panel',
  standalone: true,
  imports: [FormsModule, HlmButton, HlmInput, NgIcon, ChatMessageComponent],
  providers: [provideIcons({ heroXMark, heroSparkles, heroPaperAirplane })],
  templateUrl: './chat-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatPanelComponent {
  readonly store = inject(ChatStore);
  readonly #service = inject(ChatService);

  readonly inputValue = model('');

  readonly canSend = computed(() => this.inputValue().trim().length > 0 && !this.store.isLoading());

  readonly scrollContainer = viewChild.required<ElementRef<HTMLDivElement>>('scrollContainer');

  readonly #history = this.store.messages;
  readonly #pendingMessage = this.#service.stream.value;
  readonly #storeLoading = this.store.isLoading;

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
    let messages: PanelChatMessage[] = [...(this.#history() ?? [])];
    let pendingMessage = this.#pendingMessage()?.message;
    const statusPendingMessage = this.#pendingMessage()?.status;
    if (
      pendingMessage != undefined &&
      (pendingMessage.content?.length ?? 0) > 0 &&
      statusPendingMessage != null
    ) {
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

  private scrollToBottom(): void {
    const el = this.scrollContainer().nativeElement;
    el.scrollTop = el.scrollHeight;
  }
}
