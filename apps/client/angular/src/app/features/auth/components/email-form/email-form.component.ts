import { Component, ChangeDetectionStrategy, input, signal, effect, output } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { HlmInputGroupImports } from '@spartan-ng/helm/input-group';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroAtSymbol, heroKey } from '@ng-icons/heroicons/outline';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { debounce, email, form, FormField, hidden, maxLength, minLength, required, validate, ValidationError } from '@angular/forms/signals';
import { PasswordInputComponent } from '../password-input/password-input.component';
import { LoginMode } from '../../models/login-mode';
import { EmailFormModel } from '../../models/email-form-model';

@Component({
  selector: 'app-email-form',
  imports: [
    ReactiveFormsModule,
    HlmInputGroupImports,
    HlmInputImports,
    HlmButtonImports,
    HlmFieldImports,
    NgIcon,
    FormField,
    PasswordInputComponent
  ],
  templateUrl: './email-form.component.html',
  styleUrl: './email-form.component.css',
  providers: [provideIcons({ email: heroAtSymbol, key: heroKey })],
  host: { class: 'grid w-full max-w-sm gap-6' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmailFormComponent {
  readonly #INITIAL_MODEL: EmailFormModel = { email: '', password: '', showConfirmPassword: false, confirmPassword: '' };
  mode = input<LoginMode>('login');
  authError = input<string | null>(null);
  readonly submit = output<Pick<EmailFormModel, 'email' | 'password'>>()

  emailLoginForm = form(
    signal<EmailFormModel>({ ...this.#INITIAL_MODEL }),
    (schema) => {
      debounce(schema.email, 1000),
        debounce(schema.password, 1000),
        debounce(schema.confirmPassword, 1000),
        required(schema.email, { message: 'Email is required' }),
        required(schema.password, { message: 'Password is required' }),
        minLength(schema.password, 8, { message: 'Password must be at least 8 characters' }),
        email(schema.email, { message: 'Please enter a valid email' }),
        required(schema.confirmPassword, { message: 'Confirm Password is required' }),
        minLength(schema.confirmPassword, 8, { message: 'Confirm Password must be at least 8 characters' }),
        maxLength(schema.confirmPassword, 50, { message: 'Confirm Password must be less than 50 characters' }),
        maxLength(schema.password, 50, { message: 'Password must be less than 50 characters' }),
        validate(schema.confirmPassword, ({ valueOf }) => {
          return valueOf(schema.confirmPassword) === valueOf(schema.password) ?
            null :
            { message: 'Passwords do not match', kind: 'mismatch' } satisfies ValidationError;
        }),
        hidden(schema.confirmPassword, ({ valueOf }) => !valueOf(schema.showConfirmPassword))
    })

  constructor() {
    effect(() => {
      if (this.authError() != null) {
        const showConfirmPassword = this.emailLoginForm.showConfirmPassword().value();
        this.emailLoginForm().reset({ ...this.#INITIAL_MODEL, showConfirmPassword });
      }
    });

    effect(() => {
      const isRegistrationModeActive = this.mode() === 'registration';
      this.emailLoginForm.showConfirmPassword().value.set(isRegistrationModeActive);
    })
  }

  public onSubmit(event: Event) {
    event.preventDefault();

    if (!this.emailLoginForm().valid() || this.emailLoginForm().pending()) {
      return;
    }
    const { email, password } = this.emailLoginForm().value();
    this.submit.emit({ email, password });
  }


}
