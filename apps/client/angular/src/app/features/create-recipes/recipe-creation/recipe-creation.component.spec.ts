import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { RecipeCreationComponent } from './recipe-creation.component';
import { RecipeCreationStore } from '../services/recipe-creation.store';

describe('RecipeCreationComponent', () => {
  let component: RecipeCreationComponent;
  let fixture: ComponentFixture<RecipeCreationComponent>;
  let store: RecipeCreationStore;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    if (!HTMLElement.prototype.scrollIntoView) {
      HTMLElement.prototype.scrollIntoView = () => {};
    }

    await TestBed.configureTestingModule({
      imports: [RecipeCreationComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    store = TestBed.inject(RecipeCreationStore);
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(RecipeCreationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render four creation method cards', () => {
    const el = fixture.nativeElement as HTMLElement;
    const cards = el.querySelectorAll('app-creation-method-box');
    expect(cards.length).toBe(4);
  });

  it('should switch active method on card click', () => {
    const el = fixture.nativeElement as HTMLElement;
    const cards = el.querySelectorAll('app-creation-method-box');
    (cards[3] as HTMLElement).click();
    fixture.detectChanges();
    expect(store.activeMethod()).toBe('editor');
  });

  it('should show textarea when text mode is active', () => {
    store.setActiveMethod('text');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('textarea')).toBeTruthy();
  });

  it('should show choose image button when image mode is active', () => {
    store.setActiveMethod('image');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Choose Image');
  });

  it('should show manual editor form when editor mode is active', () => {
    store.setActiveMethod('editor');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-recipe-creation-form')).toBeTruthy();
  });

  it('should show Extracting... text on button during extraction', () => {
    store.isExtracting.set(true);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const button = el.querySelector('button[hlmBtn]') as HTMLElement;
    expect(button.textContent).toContain('Extracting...');
  });

  it('should disable save button during extraction', () => {
    store.isExtracting.set(true);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const button = el.querySelector('button[hlmBtn]') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('should display extraction error when set', () => {
    store.extractionError.set('Something went wrong');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Something went wrong');
  });

  it('should clear extraction error on method switch', () => {
    store.extractionError.set('Old error');
    store.setActiveMethod('editor');
    expect(store.extractionError()).toBeNull();
  });
});
