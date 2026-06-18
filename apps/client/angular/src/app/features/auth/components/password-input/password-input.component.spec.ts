import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PasswordInputComponent } from './password-input.component';

describe('PasswordInputComponent', () => {
  let component: PasswordInputComponent;
  let fixture: ComponentFixture<PasswordInputComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PasswordInputComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PasswordInputComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render input with password type by default', () => {
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.type).toBe('password');
  });

  it('should toggle visibility on button click', () => {
    expect(component.visible()).toBe(false);
    const toggleBtn = fixture.nativeElement.querySelector(
      'button[aria-label="Show password"]',
    ) as HTMLButtonElement;
    expect(toggleBtn).toBeTruthy();
    toggleBtn.click();
    expect(component.visible()).toBe(true);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.type).toBe('text');
  });

  it('should update value on input', () => {
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = 'my-password';
    input.dispatchEvent(new Event('input'));
    expect(component.value()).toBe('my-password');
  });

  it('should mark touched on blur', () => {
    expect(component.touched()).toBe(false);
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.dispatchEvent(new Event('blur'));
    expect(component.touched()).toBe(true);
  });

  it('should show error messages with role="alert" when invalid and touched', () => {
    fixture.componentRef.setInput('invalid', true);
    fixture.componentRef.setInput('touched', true);
    fixture.componentRef.setInput('errors', [
      { message: 'Password is required', kind: 'required' },
    ]);
    fixture.detectChanges();
    const alert = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;
    expect(alert).toBeTruthy();
    expect(alert.textContent).toContain('Password is required');
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('should disable input when disabled is true', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });

  it('should not render forgot password link by default', () => {
    const link = fixture.nativeElement.querySelector('button[hlmBtn][variant="link"]');
    expect(link).toBeFalsy();
  });

  it('should render forgot password link when forgotPasswordLabel is set', () => {
    fixture.componentRef.setInput('forgotPasswordLabel', 'Forgot?');
    fixture.detectChanges();
    const link = fixture.nativeElement.querySelector(
      'button[hlmBtn][variant="link"]',
    ) as HTMLButtonElement;
    expect(link).toBeTruthy();
    expect(link.textContent).toContain('Forgot?');
  });

  it('should emit forgotPassword output when the link is clicked', () => {
    fixture.componentRef.setInput('forgotPasswordLabel', 'Forgot?');
    fixture.detectChanges();
    const spy = vi.spyOn(component.forgotPassword, 'emit');
    const link = fixture.nativeElement.querySelector(
      'button[hlmBtn][variant="link"]',
    ) as HTMLButtonElement;
    link.click();
    expect(spy).toHaveBeenCalledOnce();
  });

  it('should not render strength meter by default', () => {
    component.value.set('Abcdefg1!');
    fixture.detectChanges();
    const meter = fixture.nativeElement.querySelector('[role="status"]');
    expect(meter).toBeFalsy();
  });

  it('should render strength meter when showStrengthMeter is true and value is set', () => {
    fixture.componentRef.setInput('showStrengthMeter', true);
    component.value.set('Abcdefg1!');
    fixture.detectChanges();
    const meter = fixture.nativeElement.querySelector('[role="status"]') as HTMLElement;
    expect(meter).toBeTruthy();
    expect(meter.textContent).toContain('Strong');
  });

  it('should not render strength meter when value is empty even if showStrengthMeter is true', () => {
    fixture.componentRef.setInput('showStrengthMeter', true);
    component.value.set('');
    fixture.detectChanges();
    const meter = fixture.nativeElement.querySelector('[role="status"]');
    expect(meter).toBeFalsy();
  });

  it('should update strength label based on password value', () => {
    fixture.componentRef.setInput('showStrengthMeter', true);
    component.value.set('abc');
    fixture.detectChanges();
    let meter = fixture.nativeElement.querySelector('[role="status"]') as HTMLElement;
    expect(meter.textContent).toContain('Too short');

    component.value.set('Abcdefg1!');
    fixture.detectChanges();
    meter = fixture.nativeElement.querySelector('[role="status"]') as HTMLElement;
    expect(meter.textContent).toContain('Strong');
  });

  it('should have current-password autocomplete by default', () => {
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.getAttribute('autocomplete')).toBe('current-password');
  });

  it('should accept new-password autocomplete for registration flows', () => {
    fixture.componentRef.setInput('autocomplete', 'new-password');
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.getAttribute('autocomplete')).toBe('new-password');
  });
});
