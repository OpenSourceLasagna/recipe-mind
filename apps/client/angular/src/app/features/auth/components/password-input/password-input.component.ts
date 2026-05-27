import { Component, input, InputSignal, InputSignalWithTransform, model, ModelSignal, signal } from '@angular/core';
import { FormField, FormValueControl, ValidationError } from '@angular/forms/signals';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroEye, heroEyeSlash } from '@ng-icons/heroicons/outline';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputGroupImports } from '@spartan-ng/helm/input-group';

@Component({
  selector: 'app-password-input',
  imports: [HlmFieldImports, HlmInputGroupImports, NgIcon],
  providers: [provideIcons({ eye: heroEye, eyeSlash: heroEyeSlash })],
  templateUrl: './password-input.component.html',
  styleUrl: './password-input.component.css',
})
export class PasswordInputComponent implements FormValueControl<string> {
  value = model('');
  disabled = input<boolean>(false);
  invalid = input<boolean>(false);
  errors = input<readonly ValidationError[]>([]);
  touched = model<boolean>(false);
  displayValue = signal('');
  required = input<boolean>(false);
  name = input<string>('password');
  placeholder = input<string>('Enter your password');
  label = input<string>('Password');

  visible = signal(false);

  handleInput(input: string) {
    this.value.set(input);
  }

  changeVisibility() {
    this.visible.update((v) => !v);
  }
}
