import { Component, computed, effect, inject, input, Signal, signal, WritableSignal } from '@angular/core';
import { EmailFormComponent } from '../components/email-form/email-form.component';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { LoginMode } from '../models/login-mode';
import { AuthService } from '../../../core/auth/auth.service';
import { EmailFormModel } from '../models/email-form-model';
import { Router } from '@angular/router';

type CardHeaderText = { button: string, title: string, description: string }

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
  imports: [EmailFormComponent, HlmFieldImports, HlmCardImports, HlmButtonImports],
  host: {
    class: 'flex flex-col items-center justify-center w-full max-w-md mx-auto p-4'
  }
})
export class LoginComponent {
  mode = input<LoginMode>('login');
  error = signal<string | null>(null);
  #authService = inject(AuthService);
  #router = inject(Router);

  constructor() {
    effect(() => {
      if (this.#authService.isAuthenticated()) {
        this.#router.navigate(['/dashboard']);
      }
    });
  }

  typeText: Signal<CardHeaderText> = computed(() => this.mode() === 'login' ?
    {
      button: 'Create account',
      title: 'Sign in',
      description: 'Sign in to access your personalized recipe book'
    } : {
      button: 'Sign in',
      title: 'Create a new account ',
      description: 'Create an account to start building your personalized recipe book'
    });

  async onSubmitEmailLogin(formValue: Pick<EmailFormModel, 'email' | 'password'>) {
    const { email, password } = formValue;
    if (!email || !password) {
      this.error.set('Email and password are required');
      return;
    }
    try {
      if (this.mode() === 'login') {
        await this.#authService.signInWithEmailAndPassword(email, password);
      } else {
        await this.#authService.signUpWithEmailAndPassword(email, password);
      }
      this.error.set(null);
    } catch (e: Error | unknown) {
      const errorBase = this.mode() === 'login' ? 'Unable to sign in' : 'Unable to create account';
      this.error.set(`${errorBase}: ${(e as Error).message}`);
      return;
    }
  }

  changeType() {
    this.#router.navigate([this.mode() === 'login' ? 'auth/registration' : 'auth/login']);
  }
}
