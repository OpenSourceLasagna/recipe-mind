import { computed, Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { createClient, Session, User } from '@supabase/supabase-js';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  readonly #currentUser = signal<User | null>(null);
  readonly #session = signal<Session | null>(null);
  readonly #supabase = createClient(environment.supabaseUrl, environment.supabasePubKey);

  readonly currentUser = this.#currentUser.asReadonly();
  readonly isAuthenticated = computed(() => this.#currentUser()?.id != null);
  readonly accessToken = computed(() => this.#session()?.access_token ?? null);

  constructor() {
    this.#supabase.auth.onAuthStateChange((_event, session) => {
      this.#currentUser.set(session?.user ?? null);
      this.#session.set(session);
    });
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
    if (error) throw error;
    this.#currentUser.set(null);
  }

  async signInWithGoogle() {
    throw new Error("Google is not yet supported in this demo. Please use Email/PW to sign in.");
    const { error } = await this.#supabase.auth.signInWithOAuth({ provider: 'google' });
    if (error) throw error;
  }

  async signInWithGitHub() {
    throw new Error("GitHub is not yet supported in this demo. Please use Email/PW to sign in.");
    const { error } = await this.#supabase.auth.signInWithOAuth({ provider: 'github' });
    if (error) throw error;
  }
}

