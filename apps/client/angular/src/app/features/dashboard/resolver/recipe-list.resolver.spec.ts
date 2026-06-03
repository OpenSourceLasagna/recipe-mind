import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { RecipeFilterService } from '../services/recipe-filter.service';
import { recipeListResolver } from './recipe-list.resolver';

describe('recipeListResolver', () => {
  let filterService: RecipeFilterService;

  beforeEach(() => {
    TestBed.configureTestingModule({});

    filterService = TestBed.inject(RecipeFilterService);
  });

  const mockState = {} as RouterStateSnapshot;

  it('should hydrate filter from URL params and return true', () => {
    const route = {
      queryParams: {
        query: 'pasta',
        difficulty: 'easy',
        sortBy: 'relevance',
        page: '2',
      },
    } as unknown as ActivatedRouteSnapshot;

    const result = TestBed.runInInjectionContext(() =>
      recipeListResolver(route, mockState),
    );

    expect(result).toBe(true);
    expect(filterService.query()).toBe('pasta');
    expect(filterService.model().difficulty).toBe('easy');
    expect(filterService.model().sortBy).toBe('relevance');
    expect(filterService.toHttpParams().get('page')).toBe('2');
  });

  it('should handle empty params with defaults', () => {
    const route = { queryParams: {} } as unknown as ActivatedRouteSnapshot;

    const result = TestBed.runInInjectionContext(() =>
      recipeListResolver(route, mockState),
    );

    expect(result).toBe(true);
    expect(filterService.query()).toBeNull();
    expect(filterService.model().sortBy).toBe('created_at');
  });

  it('should set sortBy to relevance when query present without explicit sortBy', () => {
    const route = {
      queryParams: { query: 'curry' },
    } as unknown as ActivatedRouteSnapshot;

    TestBed.runInInjectionContext(() => recipeListResolver(route, mockState));

    expect(filterService.model().sortBy).toBe('relevance');
  });

  it('should respect explicit sortBy when query is present', () => {
    const route = {
      queryParams: { query: 'curry', sortBy: 'title' },
    } as unknown as ActivatedRouteSnapshot;

    TestBed.runInInjectionContext(() => recipeListResolver(route, mockState));

    expect(filterService.model().sortBy).toBe('title');
  });
});