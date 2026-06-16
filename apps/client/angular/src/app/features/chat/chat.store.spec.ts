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
});
