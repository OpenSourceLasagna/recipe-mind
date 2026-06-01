import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { provideRouter, Router } from '@angular/router';

import { NavBarComponent } from './nav-bar.component';
import { AuthService } from '../../../core/auth/auth.service';
import { createAuthServiceMock } from '../../../testing/auth-service.mock';

describe('NavBarComponent', () => {
  let component: NavBarComponent;
  let fixture: ComponentFixture<NavBarComponent>;
  let router: Router;
  let authService: ReturnType<typeof createAuthServiceMock>;

  beforeEach(async () => {
    const mock = createAuthServiceMock();

    await TestBed.configureTestingModule({
      imports: [NavBarComponent],
      providers: [
        provideRouter([]),
        provideLocationMocks(),
        { provide: AuthService, useValue: mock },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    authService = TestBed.inject(AuthService) as unknown as ReturnType<typeof createAuthServiceMock>;
    fixture = TestBed.createComponent(NavBarComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render logo and all 4 nav items', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('CulinarAI');
    expect(el.textContent).toContain('Explore');
    expect(el.textContent).toContain('AI Chef');
    expect(el.textContent).toContain('Add New');
    expect(el.textContent).toContain('Saved');
  });

  it('should have profile buttons with aria-label', () => {
    const el = fixture.nativeElement as HTMLElement;
    const profileBtns = el.querySelectorAll('button[aria-label="Profile"]');
    expect(profileBtns.length).toBeGreaterThanOrEqual(1);
  });

  it('profile() should navigate to /dashboard/profile', () => {
    const spy = vi.spyOn(router, 'navigate');
    component.profile();
    expect(spy).toHaveBeenCalledWith(['/dashboard/profile']);
  });

  it('settings() should navigate to /dashboard/settings', () => {
    const spy = vi.spyOn(router, 'navigate');
    component.settings();
    expect(spy).toHaveBeenCalledWith(['/dashboard/settings']);
  });

  it('logout() should call authService.signOut() and navigate to /auth/login', async () => {
    const navigateSpy = vi.spyOn(router, 'navigate');
    await component.logout();
    expect(authService.signOut).toHaveBeenCalledOnce();
    expect(navigateSpy).toHaveBeenCalledWith(['/auth/login']);
  });

  it('logout() should not navigate when signOut throws', async () => {
    authService.signOut.mockRejectedValueOnce(new Error('fail'));
    const navigateSpy = vi.spyOn(router, 'navigate');
    await component.logout();
    expect(authService.signOut).toHaveBeenCalledOnce();
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
