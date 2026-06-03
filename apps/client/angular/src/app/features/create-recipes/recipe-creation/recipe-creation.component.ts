import { Component, effect, ElementRef, inject, signal, viewChild } from '@angular/core';
import { CreationMethodBoxComponent } from "../components/creation-method-box/creation-method-box.component";
import { NgIcon, provideIcons } from "@ng-icons/core";
import { heroDocumentText, heroLink, heroPhoto } from '@ng-icons/heroicons/outline';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmButton } from '@spartan-ng/helm/button';
import { FormsModule } from '@angular/forms';
import { RecipeCreationFormComponent } from "../components/recipe-creation-form/recipe-creation-form.component";
import { RecipeService } from '../services/recipe.service';
import { CreateRecipeRequest } from '../models/create-recipe.model';

type CreationMethod = 'text' | 'link' | 'image' | 'editor';

@Component({
  selector: 'app-recipe-creation',
  imports: [CreationMethodBoxComponent, NgIcon, HlmCardImports, HlmInputImports, HlmFieldImports, HlmButton, FormsModule, RecipeCreationFormComponent],
  providers: [provideIcons({ link: heroLink, image: heroPhoto, text: heroDocumentText })],
  templateUrl: './recipe-creation.component.html',
  styleUrl: './recipe-creation.component.css',
})
export class RecipeCreationComponent {
  readonly activeMethod = signal<CreationMethod>('link');
  readonly urlInput = signal<string>('');
  readonly rawTextInput = signal<string>('');
  readonly editorForm = viewChild<RecipeCreationFormComponent>('recipeEditor')
  readonly #recipeService = inject(RecipeService)
  readonly formCard = viewChild<ElementRef>('formCard')

  setActiveMethod(method: CreationMethod) {
    this.activeMethod.set(method);
    this.formCard()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  submitCurrentMode(event: Event) {
    switch (this.activeMethod()) {
      case 'editor': {
        this.editorForm()?.submit(event);
        return;
      }
      case 'image': {
        return;
      }
      case 'link': {
        this.#recipeService.addUrlRecipe(this.urlInput());
        return;
      }
      case 'text': {
        this.#recipeService.addTextRecipe(this.rawTextInput());
        return;
      }
    }
  }

  onRecipeEditorSubmit(recipe: CreateRecipeRequest) {
    this.#recipeService.addStructuredRecipe(recipe).subscribe(console.log);
  }
}
