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
  readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');
  readonly isSubmitting = signal(false);

  setActiveMethod(method: CreationMethod) {
    this.store.setActiveMethod(method);
    this.formCard()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  triggerImageUpload() {
    this.fileInput().nativeElement.click();
  }

  onImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
    if (file.size > MAX_IMAGE_BYTES) {
      this.store.extractionError.set('Image is too large. Please choose an image under 10 MB.');
      input.value = '';
      return;
    }

    const ALLOWED_TYPES = ['image/jpeg', 'image/png'];
    if (!ALLOWED_TYPES.includes(file.type)) {
      this.store.extractionError.set('Unsupported image type. Please use JPEG or PNG.');
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      this.store.extract('image', base64).subscribe();
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  async pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) {
        this.store.rawTextInput.set(text);
      }
    } catch {
      this.store.extractionError.set(
        'Unable to read clipboard. Please paste manually or grant clipboard permission.',
      );
    }
  }

  submitCurrentMode() {
    if (this.isSubmitting() || this.store.isExtracting()) return;

    if (this.store.activeMethod() === 'text' || this.store.activeMethod() === 'link') {
      this.isSubmitting.set(true);
      const content =
        this.store.activeMethod() === 'link' ? this.store.urlInput() : this.store.rawTextInput();
      const source = this.store.activeMethod() === 'link' ? 'url' : 'text';
      this.store.extract(source, content).subscribe({
        next: () => {
          this.isSubmitting.set(false);
        },
        error: () => {
          this.isSubmitting.set(false);
        },
      });
      return;
    }

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
