import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroSparkles } from '@ng-icons/heroicons/outline';
import { HlmButton } from '@spartan-ng/helm/button';
import { ChatStore } from '../../chat.store';

@Component({
  selector: 'app-chat-button',
  standalone: true,
  imports: [HlmButton, NgIcon],
  providers: [provideIcons({ heroSparkles })],
  template: `
    <button
      hlmBtn
      variant="outline"
      size="icon"
      type="button"
      aria-label="Open AI Chef chat"
      (click)="store.toggle()"
      [class.bg-primary]="store.isOpen()"
      [class.text-primary-foreground]="store.isOpen()"
    >
      <ng-icon hlm name="heroSparkles" />
    </button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatButtonComponent {
  readonly store = inject(ChatStore);
}
