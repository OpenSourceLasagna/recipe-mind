import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RecipeSearchBarComponent } from './recipe-search-bar.component';
import { RecipeFilterService } from '../../services/recipe-filter.service';

describe('RecipeSearchBarComponent', () => {
  let component: RecipeSearchBarComponent;
  let fixture: ComponentFixture<RecipeSearchBarComponent>;
  let filterService: RecipeFilterService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [RecipeSearchBarComponent],
    });

    filterService = TestBed.inject(RecipeFilterService);
    fixture = TestBed.createComponent(RecipeSearchBarComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start with empty input when query is null', () => {
    expect(component.queryForm.query().value()).toBe('');
  });

  it('should sync query from filter service on init', () => {
    filterService.setQuery('pasta');
    fixture = TestBed.createComponent(RecipeSearchBarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    expect(component.queryForm.query().value()).toBe('pasta');
  });

  it('should call setQuery on submit with current value', () => {
    const spy = vi.spyOn(filterService, 'setQuery');
    component.queryForm.query().value.set('curry');
    component.submit();
    expect(spy).toHaveBeenCalledWith('curry');
  });

  it('should not call setQuery on submit if value has not changed since last submit', () => {
    component.queryForm.query().value.set('curry');
    component.submit();

    const spy = vi.spyOn(filterService, 'setQuery');
    component.submit();
    expect(spy).not.toHaveBeenCalled();
  });

  it('should call setQuery on submit after value changes', () => {
    component.queryForm.query().value.set('curry');
    component.submit();

    const spy = vi.spyOn(filterService, 'setQuery');
    component.queryForm.query().value.set('pasta');
    component.submit();
    expect(spy).toHaveBeenCalledWith('pasta');
  });

  it('should call setQuery with null on clear after a previous search', () => {
    component.queryForm.query().value.set('pasta');
    component.submit();

    const spy = vi.spyOn(filterService, 'setQuery');
    component.clear();
    expect(component.queryForm.query().value()).toBe('');
    expect(spy).toHaveBeenCalledWith(null);
  });

  it('should have correct placeholder text', () => {
    fixture.detectChanges();
    const inputEl = fixture.nativeElement.querySelector('input');
    expect(inputEl.placeholder).toBe('Search recipes...');
  });
});