import { TestBed } from '@angular/core/testing';
import { HttpParams } from '@angular/common/http';
import { RecipeFilterService } from './recipe-filter.service';
import {
  DURATION_RANGE,
  SERVINGS_RANGE,
  DEFAULT_SORT,
  DEFAULT_FILTER_MODEL,
} from '../models/recipe-filter.model';

describe('RecipeFilterService', () => {
  let service: RecipeFilterService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RecipeFilterService);
  });

  describe('initial state', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should have default model values', () => {
      const model = service.model();
      expect(model.difficulty).toBeNull();
      expect(model.spiceMax).toBeNull();
      expect(model.duration).toEqual([...DURATION_RANGE]);
      expect(model.servings).toEqual([...SERVINGS_RANGE]);
      expect(model.origin).toBeNull();
      expect(model.categories).toBeNull();
      expect(model.sortBy).toBe('created_at');
      expect(model.sortOrder).toBe('desc');
    });

    it('should have null query by default', () => {
      expect(service.query()).toBeNull();
    });

    it('should produce default http params', () => {
      const params = service.toHttpParams();
      expect(params.get('query')).toBeNull();
      expect(params.get('difficulty')).toBeNull();
      expect(params.get('spiceLevelMax')).toBeNull();
      expect(params.get('sortBy')).toBe('created_at');
      expect(params.get('sortOrder')).toBe('desc');
      expect(params.get('page')).toBe('1');
      expect(params.get('pageSize')).toBe('20');
    });

    it('should have no active filters by default', () => {
      expect(service.activeFilters()).toEqual([]);
    });
  });

  describe('setQuery', () => {
    it('should set the query signal', () => {
      service.setQuery('pasta');
      expect(service.query()).toBe('pasta');
    });

    it('should switch sortBy to relevance when query is set', () => {
      service.setQuery('pasta');
      expect(service.model().sortBy).toBe('relevance');
      const params = service.toHttpParams();
      expect(params.get('sortBy')).toBe('relevance');
    });

    it('should revert sortBy to default when query is cleared', () => {
      service.setQuery('pasta');
      expect(service.model().sortBy).toBe('relevance');

      service.setQuery(null);
      expect(service.query()).toBeNull();
      expect(service.model().sortBy).toBe(DEFAULT_SORT.sortBy);
      const params = service.toHttpParams();
      expect(params.get('sortBy')).toBe('created_at');
    });

    it('should include query in http params', () => {
      service.setQuery('curry');
      const params = service.toHttpParams();
      expect(params.get('query')).toBe('curry');
    });

    it('should reset page to 1', () => {
      service.hydrateFromParams({ page: '3' });
      expect(service.toHttpParams().get('page')).toBe('3');

      service.setQuery('pasta');
      expect(service.toHttpParams().get('page')).toBe('1');
    });

    it('should handle empty string as null', () => {
      service.setQuery('');
      expect(service.query()).toBe('');
      const params = service.toHttpParams();
      expect(params.get('query')).toBeNull();
    });
  });

  describe('commit', () => {
    it('should push model values to committed signals', () => {
      service.model.update(m => ({
        ...m,
        difficulty: 'easy',
        spiceMax: 3,
        origin: 'Italian',
      }));
      service.commit();

      const params = service.toHttpParams();
      expect(params.get('difficulty')).toBe('easy');
      expect(params.get('spiceLevelMax')).toBe('3');
      expect(params.get('origin')).toBe('Italian');
    });

    it('should reset page to 1', () => {
      service.hydrateFromParams({ page: '5' });
      expect(service.toHttpParams().get('page')).toBe('5');

      service.model.update(m => ({ ...m, difficulty: 'hard' }));
      service.commit();
      expect(service.toHttpParams().get('page')).toBe('1');
    });
  });

  describe('resetAll', () => {
    it('should reset all model values to defaults', () => {
      service.model.update(m => ({
        ...m,
        difficulty: 'hard',
        spiceMax: 5,
        origin: 'Thai',
      }));
      service.commit();

      service.resetAll();

      const model = service.model();
      expect(model.difficulty).toBeNull();
      expect(model.spiceMax).toBeNull();
      expect(model.origin).toBeNull();
      expect(model.sortBy).toBe('created_at');
    });

    it('should not clear the search query', () => {
      service.setQuery('pasta');
      service.resetAll();
      expect(service.query()).toBe('pasta');
    });
  });

  describe('activeFilters', () => {
    it('should include difficulty when set', () => {
      service.model.update(m => ({ ...m, difficulty: 'easy' }));
      expect(service.activeFilters()).toContain('difficulty');
    });

    it('should include spice when set', () => {
      service.model.update(m => ({ ...m, spiceMax: 3 }));
      expect(service.activeFilters()).toContain('spice');
    });

    it('should include duration when narrower than defaults', () => {
      service.model.update(m => ({ ...m, duration: [10, 200] }));
      expect(service.activeFilters()).toContain('duration');
    });

    it('should include servings when narrower than defaults', () => {
      service.model.update(m => ({ ...m, servings: [2, 6] }));
      expect(service.activeFilters()).toContain('servings');
    });

    it('should include origin when set', () => {
      service.model.update(m => ({ ...m, origin: 'Mexican' }));
      expect(service.activeFilters()).toContain('origin');
    });

    it('should include categories when set', () => {
      service.model.update(m => ({ ...m, categories: 'vegetables,meat' }));
      expect(service.activeFilters()).toContain('categories');
    });

    it('should not include search query in active filters', () => {
      service.setQuery('pasta');
      expect(service.activeFilters()).not.toContain('query');
      expect(service.activeFilters()).not.toContain('q');
    });
  });

  describe('hydrateFromParams', () => {
    it('should hydrate query from params', () => {
      service.hydrateFromParams({ query: 'pasta' });
      expect(service.query()).toBe('pasta');
    });

    it('should default sortBy to relevance when query present and no sortBy param', () => {
      service.hydrateFromParams({ query: 'pasta' });
      expect(service.model().sortBy).toBe('relevance');
      expect(service.toHttpParams().get('sortBy')).toBe('relevance');
    });

    it('should respect explicit sortBy even when query is present', () => {
      service.hydrateFromParams({ query: 'pasta', sortBy: 'title' });
      expect(service.model().sortBy).toBe('title');
    });

    it('should hydrate difficulty', () => {
      service.hydrateFromParams({ difficulty: 'easy' });
      expect(service.model().difficulty).toBe('easy');
      expect(service.toHttpParams().get('difficulty')).toBe('easy');
    });

    it('should hydrate spiceMax', () => {
      service.hydrateFromParams({ spiceLevelMax: '4' });
      expect(service.model().spiceMax).toBe(4);
      expect(service.toHttpParams().get('spiceLevelMax')).toBe('4');
    });

    it('should hydrate duration range', () => {
      service.hydrateFromParams({ durationMin: '10', durationMax: '60' });
      expect(service.model().duration).toEqual([10, 60]);
    });

    it('should hydrate duration with only min', () => {
      service.hydrateFromParams({ durationMin: '15' });
      expect(service.model().duration).toEqual([15, DURATION_RANGE[1]]);
    });

    it('should hydrate duration with only max', () => {
      service.hydrateFromParams({ durationMax: '120' });
      expect(service.model().duration).toEqual([DURATION_RANGE[0], 120]);
    });

    it('should hydrate servings range', () => {
      service.hydrateFromParams({ servingsMin: '2', servingsMax: '8' });
      expect(service.model().servings).toEqual([2, 8]);
    });

    it('should hydrate origin', () => {
      service.hydrateFromParams({ origin: 'Italian' });
      expect(service.model().origin).toBe('Italian');
    });

    it('should hydrate categories', () => {
      service.hydrateFromParams({ ingredientCategories: 'vegetables,meat' });
      expect(service.model().categories).toBe('vegetables,meat');
    });

    it('should hydrate sortBy and sortOrder', () => {
      service.hydrateFromParams({ sortBy: 'title', sortOrder: 'asc' });
      expect(service.model().sortBy).toBe('title');
      expect(service.model().sortOrder).toBe('asc');
    });

    it('should hydrate page', () => {
      service.hydrateFromParams({ page: '3' });
      expect(service.toHttpParams().get('page')).toBe('3');
    });

    it('should handle empty params with defaults', () => {
      service.hydrateFromParams({});
      const model = service.model();
      expect(model.difficulty).toBeNull();
      expect(model.spiceMax).toBeNull();
      expect(model.duration).toEqual([...DURATION_RANGE]);
      expect(model.servings).toEqual([...SERVINGS_RANGE]);
      expect(model.origin).toBeNull();
      expect(model.categories).toBeNull();
      expect(model.sortBy).toBe('created_at');
      expect(model.sortOrder).toBe('desc');
      expect(service.query()).toBeNull();
    });

    it('should handle full param set', () => {
      service.hydrateFromParams({
        query: 'curry',
        difficulty: 'medium',
        spiceLevelMax: '3',
        durationMin: '10',
        durationMax: '60',
        servingsMin: '2',
        servingsMax: '6',
        origin: 'Indian',
        ingredientCategories: 'spices',
        sortBy: 'relevance',
        sortOrder: 'asc',
        page: '2',
      });

      expect(service.query()).toBe('curry');
      expect(service.model().difficulty).toBe('medium');
      expect(service.model().spiceMax).toBe(3);
      expect(service.model().duration).toEqual([10, 60]);
      expect(service.model().servings).toEqual([2, 6]);
      expect(service.model().origin).toBe('Indian');
      expect(service.model().categories).toBe('spices');
      expect(service.model().sortBy).toBe('relevance');
      expect(service.model().sortOrder).toBe('asc');
      expect(service.toHttpParams().get('page')).toBe('2');
    });
  });

  describe('toHttpParams', () => {
    it('should not include null values', () => {
      const params = service.toHttpParams();
      expect(params.get('query')).toBeNull();
      expect(params.get('difficulty')).toBeNull();
      expect(params.get('spiceLevelMax')).toBeNull();
      expect(params.get('origin')).toBeNull();
      expect(params.get('ingredientCategories')).toBeNull();
    });

    it('should not include default duration range bounds', () => {
      const params = service.toHttpParams();
      expect(params.get('durationMin')).toBeNull();
      expect(params.get('durationMax')).toBeNull();
    });

    it('should not include default servings range bounds', () => {
      const params = service.toHttpParams();
      expect(params.get('servingsMin')).toBeNull();
      expect(params.get('servingsMax')).toBeNull();
    });

    it('should include duration bounds when narrower than defaults', () => {
      service.model.update(m => ({ ...m, duration: [10, 60] }));
      service.commit();

      const params = service.toHttpParams();
      expect(params.get('durationMin')).toBe('10');
      expect(params.get('durationMax')).toBe('60');
    });

    it('should use query param name instead of q', () => {
      service.setQuery('test');
      const params = service.toHttpParams();
      expect(params.get('query')).toBe('test');
      expect(params.get('q')).toBeNull();
    });
  });

  describe('setSortValue', () => {
    it('should update sort model', () => {
      service.setSortValue({ sortBy: 'title', sortOrder: 'asc' });
      expect(service.model().sortBy).toBe('title');
      expect(service.model().sortOrder).toBe('asc');
    });
  });

  describe('toggleDifficulty', () => {
    it('should toggle difficulty on', () => {
      service.toggleDifficulty('easy');
      expect(service.model().difficulty).toBe('easy');
    });

    it('should toggle difficulty off', () => {
      service.toggleDifficulty('easy');
      service.toggleDifficulty('easy');
      expect(service.model().difficulty).toBeNull();
    });

    it('should switch between difficulties', () => {
      service.toggleDifficulty('easy');
      service.toggleDifficulty('hard');
      expect(service.model().difficulty).toBe('hard');
    });
  });
});