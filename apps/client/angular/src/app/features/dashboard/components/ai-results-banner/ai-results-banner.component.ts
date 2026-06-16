import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroArrowLeft, heroSparkles } from '@ng-icons/heroicons/outline';
import { HlmButton } from '@spartan-ng/helm/button';

@Component({
  selector: 'app-ai-results-banner',
  standalone: true,
  imports: [HlmButton, NgIcon],
  providers: [provideIcons({ heroSparkles, heroArrowLeft })],
  template: `
    <div class="flex items-center justify-between gap-3 mb-4">
      <div class="flex items-center gap-2 text-sm font-medium text-foreground">
        <ng-icon hlm name="heroSparkles" class="text-primary size-4" />
        <span>AI Chef Recommendations</span>
      </div>
      <button hlmBtn variant="ghost" size="sm" type="button" (click)="dismiss.emit()">
        <ng-icon hlm name="heroArrowLeft" class="mr-1 size-4" />
        Back to all recipes
      </button>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiResultsBannerComponent {
  readonly dismiss = output<void>();
}
