import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { createClient, Session, Subscription, User } from '@supabase/supabase-js';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  readonly #currentUser = signal<User | null>(null);
  readonly #session = signal<Session | null>(null);
  readonly #supabase = createClient(environment.supabaseUrl, environment.supabasePubKey);
  #authSubscription: Subscription | null = null;

  readonly currentUser = this.#currentUser.asReadonly();
  readonly isAuthenticated = computed(() => this.#currentUser()?.id != null);
  readonly accessToken = computed(() => this.#session()?.access_token ?? null);

  constructor() {
    const destroyRef = inject(DestroyRef);
    const { data } = this.#supabase.auth.onAuthStateChange((_event, session) => {
      this.#currentUser.set(session?.user ?? null);
      this.#session.set(session);
    });
    this.#authSubscription = data.subscription;
    destroyRef.onDestroy(() => {
      this.#authSubscription?.unsubscribe();
      this.#authSubscription = null;
    });
  }

  async restoreSession(): Promise<void> {
    const { data, error } = await this.#supabase.auth.getSession();
    if (error) {
      console.warn('Failed to restore Supabase session:', error.message);
      return;
    }
    this.#currentUser.set(data.session?.user ?? null);
    this.#session.set(data.session);
  }

  async signUpWithEmailAndPassword(email: string, password: string) {
    const { error } = await this.#supabase.auth.signUp({ email, password });
    if (error) throw error;
  }

  async signInWithEmailAndPassword(email: string, password: string) {
    const { error } = await this.#supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async signOut() {
    const { error } = await this.#supabase.auth.signOut();
    this.#currentUser.set(null);
    this.#session.set(null);
    if (error) throw error;
  }

  async signInWithGoogle() {
    throw new Error('Google is not yet supported in this demo. Please use Email/PW to sign in.');
  }

  async signInWithGitHub() {
    throw new Error('GitHub is not yet supported in this demo. Please use Email/PW to sign in.');
  }
}
