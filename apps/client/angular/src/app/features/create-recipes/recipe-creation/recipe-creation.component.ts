import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CreationMethodBoxComponent } from '../components/creation-method-box/creation-method-box.component';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroDocumentText, heroLink, heroPhoto } from '@ng-icons/heroicons/outline';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmButton } from '@spartan-ng/helm/button';
import { FormsModule } from '@angular/forms';
import { RecipeCreationFormComponent } from '../components/recipe-creation-form/recipe-creation-form.component';
import { RecipeCreationStore } from '../services/recipe-creation.store';

type CreationMethod = 'text' | 'link' | 'image' | 'editor';

@Component({
  selector: 'app-recipe-creation',
  imports: [
    CreationMethodBoxComponent,
    NgIcon,
    HlmCardImports,
    HlmInputImports,
    HlmFieldImports,
    HlmButton,
    FormsModule,
    RecipeCreationFormComponent,
  ],
  providers: [provideIcons({ link: heroLink, image: heroPhoto, text: heroDocumentText })],
  templateUrl: './recipe-creation.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeCreationComponent {
  readonly store = inject(RecipeCreationStore);
  readonly formCard = viewChild<ElementRef>('formCard');
  readonly isSubmitting = signal(false);

  setActiveMethod(method: CreationMethod) {
    this.store.setActiveMethod(method);
    this.formCard()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  submitCurrentMode() {
    if (this.isSubmitting()) return;

    this.isSubmitting.set(true);

    this.store.submitCurrentMode().subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.store.reset();
      },
      error: () => {
        this.isSubmitting.set(false);
      },
    });
  }
}
