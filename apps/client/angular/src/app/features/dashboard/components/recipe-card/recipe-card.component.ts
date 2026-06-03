import { Component, computed, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroClock, heroFire, heroUsers } from '@ng-icons/heroicons/outline';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmCardImports } from '@spartan-ng/helm/card';

export interface RecipeCardData {
  id: string;
  title: string;
  difficulty: string;
  spice_level: number;
  durationMinutes: number;
  servings: number;
}

@Component({
  selector: 'app-recipe-card',
  standalone: true,
  imports: [HlmCardImports, HlmBadgeImports, NgIcon],
  providers: [provideIcons({ heroClock, heroFire, heroUsers })],
  templateUrl: './recipe-card.component.html',
  styleUrl: './recipe-card.component.css',
})
export class RecipeCardComponent {
  readonly recipe = input.required<RecipeCardData>();
  readonly cardClick = output<string>();

  readonly spiceArray = [1, 2, 3, 4, 5];

  readonly badgeClass = computed(() => {
    switch (this.recipe().difficulty) {
      case 'easy':
        return 'text-emerald-500 border-emerald-500/30';
      case 'medium':
        return 'text-amber-500 border-amber-500/30';
      case 'hard':
        return 'text-red-500 border-red-500/30';
      default:
        return '';
    }
  });

  onClick(): void {
    this.cardClick.emit(this.recipe().id);
  }
}
