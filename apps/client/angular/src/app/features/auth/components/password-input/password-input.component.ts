import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { FormValueControl, ValidationError } from '@angular/forms/signals';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroEye, heroEyeSlash, heroExclamationCircle } from '@ng-icons/heroicons/outline';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputGroupImports } from '@spartan-ng/helm/input-group';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { scorePassword } from './password-strength';

let passwordInputIdCounter = 0;

@Component({
  selector: 'app-password-input',
  imports: [HlmFieldImports, HlmInputGroupImports, HlmButtonImports, NgIcon],
  providers: [provideIcons({ eye: heroEye, eyeSlash: heroEyeSlash, error: heroExclamationCircle })],
  templateUrl: './password-input.component.html',
  styleUrl: './password-input.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
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
  forgotPasswordLabel = input<string | null>(null);
  showStrengthMeter = input<boolean>(false);
  autocomplete = input<'current-password' | 'new-password'>('current-password');
  readonly forgotPassword = output<void>();

  readonly errorId = signal(
    `password-error-${++passwordInputIdCounter}-${Math.random().toString(36).slice(2, 8)}`,
  );

  readonly strength = computed(() => scorePassword(this.value()));

  visible = signal(false);

  handleInput(input: string) {
    this.value.set(input);
  }

  changeVisibility() {
    this.visible.update((v) => !v);
  }
}
