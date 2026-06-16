import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  OnDestroy,
  PLATFORM_ID,
} from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { RecipeDetailService } from '../../services/recipe-detail.service';
import { RecipePatchRequest } from '../../models/recipe-edit.model';
import { RecipeDetailViewComponent } from '../recipe-detail-view/recipe-detail-view.component';
import { ChatStore } from '../../../chat/chat.store';
import { ChatPanelComponent } from '../../../chat/components/chat-panel/chat-panel.component';

@Component({
  selector: 'app-recipe-detail',
  standalone: true,
  imports: [HlmButton, HlmSkeletonImports, RecipeDetailViewComponent, ChatPanelComponent],
  templateUrl: './recipe-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeDetailComponent implements OnDestroy {
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #platformId = inject(PLATFORM_ID);
  readonly detail = inject(RecipeDetailService);
  readonly chat = inject(ChatStore);

  readonly Error = Error;
  readonly skeletonItems = Array(6);

  constructor() {
    effect(() => {
      if (!isPlatformBrowser(this.#platformId)) return;
      const id = this.#route.snapshot.paramMap.get('id');
      if (id) {
        this.detail.setRecipeId(id);
        this.chat.setContextRecipe(id);
      }
    });
  }

  ngOnDestroy(): void {
    this.chat.setContextRecipe(null);
  }

  goBack(): void {
    this.detail.setRecipeId('');
    this.#router.navigate(['/dashboard', 'explore']);
  }

  onSave(patch: RecipePatchRequest): void {
    this.detail.saveEdit(patch);
  }
}
