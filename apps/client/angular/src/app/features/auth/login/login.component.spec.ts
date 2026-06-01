import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { provideRouter, Router } from '@angular/router';

import { LoginComponent } from './login.component';
import { AuthService } from '../../../core/auth/auth.service';
import { createAuthServiceMock } from '../../../testing/auth-service.mock';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let router: Router;
  let authService: ReturnType<typeof createAuthServiceMock>;

  beforeEach(async () => {
    const mock = createAuthServiceMock();

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        provideLocationMocks(),
        { provide: AuthService, useValue: mock },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    authService = TestBed.inject(AuthService) as unknown as ReturnType<typeof createAuthServiceMock>;
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render sign-in header in login mode', () => {
    fixture.componentRef.setInput('mode', 'login');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Sign in');
  });

  it('should render registration header in registration mode', () => {
    fixture.componentRef.setInput('mode', 'registration');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Create a new account');
  });

  it('typeText should return login texts when mode is login', () => {
    fixture.componentRef.setInput('mode', 'login');
    expect(component.typeText().title).toBe('Sign in');
    expect(component.typeText().button).toBe('Create account');
  });

  it('typeText should return registration texts when mode is registration', () => {
    fixture.componentRef.setInput('mode', 'registration');
    expect(component.typeText().title).toBe('Create a new account ');
    expect(component.typeText().button).toBe('Sign in');
  });

  it('onSubmitEmailLogin calls signInWithEmailAndPassword in login mode', async () => {
    authService.signInWithEmailAndPassword.mockResolvedValueOnce(undefined);
    fixture.componentRef.setInput('mode', 'login');
    await component.onSubmitEmailLogin({ email: 'a@b.com', password: '12345678' });
    expect(authService.signInWithEmailAndPassword).toHaveBeenCalledWith('a@b.com', '12345678');
    expect(component.error()).toBeNull();
  });

  it('onSubmitEmailLogin calls signUpWithEmailAndPassword in registration mode', async () => {
    authService.signUpWithEmailAndPassword.mockResolvedValueOnce(undefined);
    fixture.componentRef.setInput('mode', 'registration');
    await component.onSubmitEmailLogin({ email: 'a@b.com', password: '12345678' });
    expect(authService.signUpWithEmailAndPassword).toHaveBeenCalledWith('a@b.com', '12345678');
    expect(component.error()).toBeNull();
  });

  it('onSubmitEmailLogin sets error when email is missing', async () => {
    await component.onSubmitEmailLogin({ email: '', password: '12345678' });
    expect(component.error()).toBe('Email and password are required');
  });

  it('onSubmitEmailLogin sets error on auth failure', async () => {
    authService.signInWithEmailAndPassword.mockRejectedValueOnce(new Error('invalid credentials'));
    fixture.componentRef.setInput('mode', 'login');
    await component.onSubmitEmailLogin({ email: 'a@b.com', password: 'wrong' });
    expect(component.error()).toContain('Unable to sign in');
  });

  it('changeType navigates to auth/registration from login mode', () => {
    const spy = vi.spyOn(router, 'navigate');
    fixture.componentRef.setInput('mode', 'login');
    component.changeType();
    expect(spy).toHaveBeenCalledWith(['auth/registration']);
  });

  it('changeType navigates to auth/login from registration mode', () => {
    const spy = vi.spyOn(router, 'navigate');
    fixture.componentRef.setInput('mode', 'registration');
    component.changeType();
    expect(spy).toHaveBeenCalledWith(['auth/login']);
  });

  it('should navigate to /dashboard when isAuthenticated becomes true', () => {
    const spy = vi.spyOn(router, 'navigate');
    authService._isAuthenticated.set(true);
    // afterRenderEffect or the constructor effect should fire
    TestBed.flushEffects();
    expect(spy).toHaveBeenCalledWith(['/dashboard']);
  });
});
