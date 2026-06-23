import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  OnDestroy,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { HlmSeparator } from '@spartan-ng/helm/separator';
import { RecipeDetailService } from '../../services/recipe-detail.service';
import { RecipePatchRequest } from '../../models/recipe-edit.model';
import { RecipeDetailViewComponent } from '../recipe-detail-view/recipe-detail-view.component';
import { ChatStore } from '../../../chat/chat.store';
import { ChatPanelComponent } from '../../../chat/components/chat-panel/chat-panel.component';
import { RecipeResponse } from '../../models/recipe.model';

@Component({
  selector: 'app-recipe-detail',
  standalone: true,
  imports: [
    HlmButton,
    HlmSkeletonImports,
    HlmSeparator,
    RecipeDetailViewComponent,
    ChatPanelComponent,
  ],
  templateUrl: './recipe-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeDetailComponent implements OnDestroy {
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #platformId = inject(PLATFORM_ID);
  readonly detail = inject(RecipeDetailService);
  readonly chat = inject(ChatStore);

  readonly #params = toSignal(this.#route.params);

  readonly Error = Error;
  readonly skeletonItems = Array(6);

  readonly isSaving = signal(false);

  constructor() {
    effect(() => {
      if (!isPlatformBrowser(this.#platformId)) return;
      const params = this.#params();
      const id = params?.['id'];
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
    this.isSaving.set(true);
    this.detail.saveEdit(patch).finally(() => this.isSaving.set(false));
  }

  onSaveAsCopy(modifiedRecipe: RecipeResponse): void {}

  onDismissChanges(): void {
    this.detail.clearAiModifiedRecipe();
  }
}
