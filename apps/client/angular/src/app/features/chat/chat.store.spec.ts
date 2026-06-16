import { TestBed } from '@angular/core/testing';
import { ChatStore } from './chat.store';

describe('ChatStore', () => {
  let store: ChatStore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(ChatStore);
  });

  describe('initial state', () => {
    it('should be created', () => {
      expect(store).toBeTruthy();
    });

    it('should start with empty messages', () => {
      expect(store.messages()).toEqual([]);
    });

    it('should start closed', () => {
      expect(store.isOpen()).toBe(false);
    });

    it('should not be loading', () => {
      expect(store.isLoading()).toBe(false);
    });

    it('should have no messages', () => {
      expect(store.hasMessages()).toBe(false);
    });
  });

  describe('addMessage', () => {
    it('should append a user message with an id', () => {
      store.addMessage({ role: 'user', content: 'hello' });

      const msgs = store.messages();
      expect(msgs.length).toBe(1);
      expect(msgs[0].role).toBe('user');
      expect(msgs[0].content).toBe('hello');
      expect(typeof msgs[0].id).toBe('number');
    });

    it('should append an assistant message with an id', () => {
      store.addMessage({ role: 'assistant', content: 'hi there' });

      const msgs = store.messages();
      expect(msgs[0].role).toBe('assistant');
      expect(msgs[0].content).toBe('hi there');
    });

    it('should assign incrementing ids', () => {
      store.addMessage({ role: 'user', content: 'first' });
      store.addMessage({ role: 'user', content: 'second' });

      const msgs = store.messages();
      expect(msgs[0].id).not.toBe(msgs[1].id);
    });

    it('should set hasMessages to true after adding', () => {
      store.addMessage({ role: 'user', content: 'hello' });

      expect(store.hasMessages()).toBe(true);
    });
  });

  describe('updateLastAssistantMessage', () => {
    it('should update the content of the last assistant message', () => {
      store.addMessage({ role: 'user', content: 'q' });
      store.addMessage({ role: 'assistant', content: 'a' });
      const assistantId = store.messages()[1].id;

      store.updateLastAssistantMessage('a updated');

      const msgs = store.messages();
      expect(msgs[1].content).toBe('a updated');
      expect(msgs[1].id).toBe(assistantId);
    });

    it('should not update when last message is from user', () => {
      store.addMessage({ role: 'user', content: 'question' });

      store.updateLastAssistantMessage('attempted update');

      expect(store.messages()[0].content).toBe('question');
    });

    it('should not throw on empty message list', () => {
      expect(() => store.updateLastAssistantMessage('x')).not.toThrow();
      expect(store.messages()).toEqual([]);
    });
  });

  describe('setLoading', () => {
    it('should set loading to true', () => {
      store.setLoading(true);

      expect(store.isLoading()).toBe(true);
    });

    it('should set loading to false', () => {
      store.setLoading(true);
      store.setLoading(false);

      expect(store.isLoading()).toBe(false);
    });
  });

  describe('toggle', () => {
    it('should flip from closed to open', () => {
      store.toggle();

      expect(store.isOpen()).toBe(true);
    });

    it('should flip from open to closed', () => {
      store.open();
      store.toggle();

      expect(store.isOpen()).toBe(false);
    });
  });

  describe('open and close', () => {
    it('should open the panel', () => {
      store.open();

      expect(store.isOpen()).toBe(true);
    });

    it('should close the panel', () => {
      store.open();
      store.close();

      expect(store.isOpen()).toBe(false);
    });
  });

  describe('reset', () => {
    it('should clear messages', () => {
      store.addMessage({ role: 'user', content: 'hi' });
      store.addMessage({ role: 'assistant', content: 'hello' });

      store.reset();

      expect(store.messages()).toEqual([]);
      expect(store.hasMessages()).toBe(false);
    });

    it('should clear loading state', () => {
      store.setLoading(true);

      store.reset();

      expect(store.isLoading()).toBe(false);
    });

    it('should reset the message id counter', () => {
      store.addMessage({ role: 'user', content: 'first' });
      const firstId = store.messages()[0].id;

      store.reset();
      store.addMessage({ role: 'user', content: 'after reset' });

      expect(store.messages()[0].id).toBe(firstId);
    });
  });

  describe('aiResults', () => {
    it('should start with no ai results', () => {
      expect(store.aiResults()).toBeNull();
      expect(store.hasAiResults()).toBe(false);
    });

    it('should set ai results', () => {
      const recipes = [
        { id: '1', title: 'Pasta', difficulty: 'easy' as const, spice_level: 1, durationMinutes: 30, servings: 4 },
      ];
      store.setAiResults(recipes);

      expect(store.aiResults()).toEqual(recipes);
      expect(store.hasAiResults()).toBe(true);
    });

    it('should clear ai results', () => {
      store.setAiResults([
        { id: '1', title: 'Pasta', difficulty: 'easy' as const, spice_level: 1, durationMinutes: 30, servings: 4 },
      ]);
      store.clearAiResults();

      expect(store.aiResults()).toBeNull();
      expect(store.hasAiResults()).toBe(false);
    });

    it('should treat empty array as no results', () => {
      store.setAiResults([]);

      expect(store.hasAiResults()).toBe(false);
    });

    it('should clear ai results on reset', () => {
      store.setAiResults([
        { id: '1', title: 'Pasta', difficulty: 'easy' as const, spice_level: 1, durationMinutes: 30, servings: 4 },
      ]);
      store.reset();

      expect(store.aiResults()).toBeNull();
      expect(store.hasAiResults()).toBe(false);
    });
  });

  describe('recipe context management', () => {
    it('should start with no context recipe', () => {
      expect(store.contextRecipeId()).toBeNull();
      expect(store.contextExcluded()).toBe(false);
    });

    it('should set context recipe', () => {
      store.setContextRecipe('recipe-123');

      expect(store.contextRecipeId()).toBe('recipe-123');
    });

    it('should clear context recipe', () => {
      store.setContextRecipe('recipe-123');
      store.setContextRecipe(null);

      expect(store.contextRecipeId()).toBeNull();
    });

    it('should toggle context excluded', () => {
      store.setContextRecipe('recipe-123');
      expect(store.contextExcluded()).toBe(false);

      store.toggleContextExcluded();
      expect(store.contextExcluded()).toBe(true);

      store.toggleContextExcluded();
      expect(store.contextExcluded()).toBe(false);
    });

    it('should reset context excluded when context recipe changes', () => {
      store.setContextRecipe('recipe-123');
      store.toggleContextExcluded();
      expect(store.contextExcluded()).toBe(true);

      store.setContextRecipe('recipe-456');
      expect(store.contextExcluded()).toBe(false);
    });

    it('should clear context on reset', () => {
      store.setContextRecipe('recipe-123');
      store.toggleContextExcluded();

      store.reset();

      expect(store.contextRecipeId()).toBeNull();
      expect(store.contextExcluded()).toBe(false);
    });
  });

  describe('active recipe tracking', () => {
    it('should start with no active recipe', () => {
      expect(store.activeRecipeId()).toBeNull();
    });

    it('should set active recipe', () => {
      store.setActiveRecipe('recipe-123');

      expect(store.activeRecipeId()).toBe('recipe-123');
    });

    it('should clear active recipe', () => {
      store.setActiveRecipe('recipe-123');
      store.setActiveRecipe(null);

      expect(store.activeRecipeId()).toBeNull();
    });

    it('should clear active on reset', () => {
      store.setActiveRecipe('recipe-123');

      store.reset();

      expect(store.activeRecipeId()).toBeNull();
    });
  });

  describe('effective context resolution', () => {
    it('should return null when no context or active recipe', () => {
      expect(store.effectiveContextRecipeId()).toBeNull();
    });

    it('should return context recipe when set and not excluded', () => {
      store.setContextRecipe('context-recipe');
      store.setActiveRecipe('active-recipe');

      expect(store.effectiveContextRecipeId()).toBe('context-recipe');
    });

    it('should return active recipe when context is excluded', () => {
      store.setContextRecipe('context-recipe');
      store.toggleContextExcluded();
      store.setActiveRecipe('active-recipe');

      expect(store.effectiveContextRecipeId()).toBe('active-recipe');
    });

    it('should return active recipe when no context recipe', () => {
      store.setActiveRecipe('active-recipe');

      expect(store.effectiveContextRecipeId()).toBe('active-recipe');
    });

    it('should return null when context excluded and no active', () => {
      store.setContextRecipe('context-recipe');
      store.toggleContextExcluded();

      expect(store.effectiveContextRecipeId()).toBeNull();
    });
  });

  describe('recipe messages', () => {
    it('should add recipe message with role recipe', () => {
      store.addMessage({
        role: 'recipe',
        content: '',
        recipeContext: {
          originalRecipe: { id: 'recipe-1', title: 'Pasta' } as any,
          isActive: false,
          isEditing: false,
        },
      });

      const msgs = store.messages();
      expect(msgs.length).toBe(1);
      expect(msgs[0].role).toBe('recipe');
      expect(msgs[0].recipeContext?.originalRecipe.id).toBe('recipe-1');
    });

    it('should expand recipe into chat as new message', () => {
      const originalRecipe = { id: 'recipe-1', title: 'Pasta' } as any;
      const modifiedRecipe = { id: 'recipe-1', title: 'Modified Pasta' } as any;

      store.expandRecipe(originalRecipe, modifiedRecipe, ['title']);

      const msgs = store.messages();
      expect(msgs.length).toBe(1);
      expect(msgs[0].role).toBe('recipe');
      expect(msgs[0].recipeContext?.originalRecipe).toBe(originalRecipe);
      expect(msgs[0].recipeContext?.modifiedRecipe).toBe(modifiedRecipe);
      expect(msgs[0].recipeContext?.changedFields).toEqual(['title']);
    });

    it('should set expanded recipe as active', () => {
      const originalRecipe = { id: 'recipe-1', title: 'Pasta' } as any;

      store.expandRecipe(originalRecipe);

      expect(store.activeRecipeId()).toBe('recipe-1');
    });

    it('should collapse recipe message', () => {
      const originalRecipe = { id: 'recipe-1', title: 'Pasta' } as any;
      store.expandRecipe(originalRecipe);
      const messageId = store.messages()[0].id;

      store.collapseRecipe(messageId);

      const msgs = store.messages();
      expect(msgs[0].recipeContext?.isActive).toBe(false);
    });

    it('should update active recipe when collapsing current active', () => {
      const recipe1 = { id: 'recipe-1', title: 'Pasta' } as any;
      const recipe2 = { id: 'recipe-2', title: 'Pizza' } as any;

      store.expandRecipe(recipe1);
      store.expandRecipe(recipe2);

      expect(store.activeRecipeId()).toBe('recipe-2');

      const msg2Id = store.messages()[1].id;
      store.collapseRecipe(msg2Id);

      expect(store.activeRecipeId()).toBe('recipe-1');
    });

    it('should clear active when collapsing only expanded recipe', () => {
      const recipe = { id: 'recipe-1', title: 'Pasta' } as any;
      store.expandRecipe(recipe);
      const messageId = store.messages()[0].id;

      store.collapseRecipe(messageId);

      expect(store.activeRecipeId()).toBeNull();
    });
  });

  describe('unsaved changes detection', () => {
    it('should return false when no recipe messages', () => {
      expect(store.hasUnsavedRecipeChanges()).toBe(false);
    });

    it('should return false when recipe has no modifications', () => {
      const recipe = { id: 'recipe-1', title: 'Pasta' } as any;
      store.expandRecipe(recipe);

      expect(store.hasUnsavedRecipeChanges()).toBe(false);
    });

    it('should return true when recipe has modifications', () => {
      const original = { id: 'recipe-1', title: 'Pasta' } as any;
      const modified = { id: 'recipe-1', title: 'Modified' } as any;
      store.expandRecipe(original, modified, ['title']);

      expect(store.hasUnsavedRecipeChanges()).toBe(true);
    });

    it('should return true when recipe is being edited', () => {
      const recipe = { id: 'recipe-1', title: 'Pasta' } as any;
      store.expandRecipe(recipe);
      const messageId = store.messages()[0].id;

      store.setRecipeEditing(messageId, true);

      expect(store.hasUnsavedRecipeChanges()).toBe(true);
    });

    it('should clear unsaved state on reset', () => {
      const original = { id: 'recipe-1', title: 'Pasta' } as any;
      const modified = { id: 'recipe-1', title: 'Modified' } as any;
      store.expandRecipe(original, modified, ['title']);

      store.reset();

      expect(store.hasUnsavedRecipeChanges()).toBe(false);
    });
  });
});
