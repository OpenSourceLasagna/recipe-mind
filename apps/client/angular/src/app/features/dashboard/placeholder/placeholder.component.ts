import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-placeholder',
  template: `
    <div class="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      <h1 class="text-3xl font-bold text-foreground">{{ title }}</h1>
      <p class="text-muted-foreground max-w-md">{{ description }}</p>
    </div>
  `,
})
export class PlaceholderComponent {
  readonly route = inject(ActivatedRoute);
  readonly title = this.route.snapshot.data['title'] ?? 'Coming Soon';
  readonly description = this.route.snapshot.data['description'] ?? 'This feature is under development.';
}
