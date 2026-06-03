import { Component, input, output } from '@angular/core';
import { HlmCardImports } from '@spartan-ng/helm/card';

@Component({
  selector: 'app-creation-method-box',
  imports: [HlmCardImports],
  templateUrl: './creation-method-box.component.html',
  styleUrl: './creation-method-box.component.css',
})
export class CreationMethodBoxComponent {
  readonly active = input<boolean>(false);
  readonly click = output<void>();


  onClick() {
    this.click.emit()
  }
}
