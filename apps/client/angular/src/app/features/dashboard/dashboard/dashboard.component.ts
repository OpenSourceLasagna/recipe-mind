import { Component, inject } from '@angular/core';
import { RecipeService } from '../../recipes/services/recipe.service';
import { HlmButton } from "@spartan-ng/helm/button";
import { RecipeCreationComponent } from "../../recipes/recipe-creation/recipe-creation.component";

@Component({
  selector: 'app-dashboard',
  imports: [HlmButton, RecipeCreationComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent {
  x = inject(RecipeService)

  y() {
    this.x.getRecipe()
  }

}
