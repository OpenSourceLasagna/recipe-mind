import { signal, type Signal, type WritableSignal } from '@angular/core';
import { AuthService } from '../core/auth/auth.service';

export interface AuthServiceMock {
  signInWithEmailAndPassword: ReturnType<typeof vi.fn>;
  signUpWithEmailAndPassword: ReturnType<typeof vi.fn>;
  signOut: ReturnType<typeof vi.fn>;
  signInWithGoogle: ReturnType<typeof vi.fn>;
  signInWithGitHub: ReturnType<typeof vi.fn>;
  isAuthenticated: Signal<boolean>;
  currentUser: Signal<null>;
  accessToken: Signal<string | null>;
  _isAuthenticated: WritableSignal<boolean>;
}

export function createAuthServiceMock(): AuthServiceMock {
  const _isAuthenticated = signal(false);

  return {
    signInWithEmailAndPassword: vi.fn(),
    signUpWithEmailAndPassword: vi.fn(),
    signOut: vi.fn<AuthService['signOut']>(),
    signInWithGoogle: vi.fn(),
    signInWithGitHub: vi.fn(),
    isAuthenticated: _isAuthenticated.asReadonly(),
    currentUser: signal(null).asReadonly(),
    accessToken: signal(null).asReadonly(),
    _isAuthenticated,
  };
}
