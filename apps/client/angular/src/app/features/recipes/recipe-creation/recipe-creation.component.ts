import { Component, effect, signal } from '@angular/core';
import { CreationMethodBoxComponent } from "../components/creation-method-box/creation-method-box.component";
import { NgIcon, provideIcons } from "@ng-icons/core";
import { heroDocumentText, heroLink, heroPhoto } from '@ng-icons/heroicons/outline';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmButton } from '@spartan-ng/helm/button';
import { FormsModule } from '@angular/forms';
import { RecipeCreationFormComponent } from "../components/recipe-creation-form/recipe-creation-form.component";

type CreationMethod = 'text' | 'link' | 'image' | 'editor';

@Component({
  selector: 'app-recipe-creation',
  imports: [CreationMethodBoxComponent, NgIcon, HlmCardImports, HlmInputImports, HlmFieldImports, HlmButton, FormsModule, RecipeCreationFormComponent],
  providers: [provideIcons({ link: heroLink, image: heroPhoto, text: heroDocumentText})],
  templateUrl: './recipe-creation.component.html',
  styleUrl: './recipe-creation.component.css',
})
export class RecipeCreationComponent {
  readonly activeMethod = signal<CreationMethod>('link');
  readonly urlInput = signal<string>('');

  setActiveMethod(method: CreationMethod) {
    this.activeMethod.set(method);
  }


}
