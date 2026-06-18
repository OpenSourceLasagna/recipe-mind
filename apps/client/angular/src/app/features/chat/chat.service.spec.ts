import { TestBed } from '@angular/core/testing';
import { ChatService } from './chat.service';
import { ChatStore } from './chat.store';
import { FetchService } from '../../core/services/fetch.service';

function makeSseResponse(events: string[]): Response {
  const body = events.join('\n\n') + '\n\n';
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(body));
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

describe('ChatService', () => {
  let service: ChatService;
  let store: ChatStore;
  let fetchService: { fetch: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    fetchService = {
      fetch: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [{ provide: FetchService, useValue: fetchService }],
    });

    store = TestBed.inject(ChatStore);
    service = TestBed.inject(ChatService);
  });

  describe('sendMessage', () => {
    it('should ignore empty messages', () => {
      service.sendMessage('   ');

      expect(store.messages().length).toBe(0);
      expect(fetchService.fetch).not.toHaveBeenCalled();
    });

    it('should add user message to the store', () => {
      fetchService.fetch.mockResolvedValue(makeSseResponse([]));

      service.sendMessage('hello');

      const msgs = store.messages();
      expect(msgs.length).toBe(1);
      expect(msgs[0].role).toBe('user');
      expect(msgs[0].content).toBe('hello');
    });

    it('should trim whitespace from message before sending', () => {
      fetchService.fetch.mockResolvedValue(makeSseResponse([]));

      service.sendMessage('  hi there  ');

      const msgs = store.messages();
      expect(msgs[0].content).toBe('hi there');
    });
  });

  describe('stream integration', () => {
    it('should expose stream as a resource', () => {
      expect(service.stream).toBeDefined();
    });

    it('should POST to the chat endpoint with the request body', async () => {
      fetchService.fetch.mockResolvedValue(makeSseResponse([]));

      service.sendMessage('test');
      await new Promise((r) => setTimeout(r, 0));

      expect(fetchService.fetch).toHaveBeenCalledTimes(1);
      const [url, init] = fetchService.fetch.mock.calls[0];
      expect(url).toContain('/v1/ai-chef/chat');
      expect(init.method).toBe('POST');
      const body = JSON.parse(init.body);
      expect(body.message).toBe('test');
    });

    it('should send conversation history with the request', async () => {
      fetchService.fetch.mockResolvedValue(makeSseResponse([]));
      store.addMessage({ role: 'user', content: 'previous question' });
      store.addMessage({ role: 'assistant', content: 'previous answer' });

      service.sendMessage('new question');
      await new Promise((r) => setTimeout(r, 0));

      const body = JSON.parse(fetchService.fetch.mock.calls[0][1].body);
      expect(body.conversationHistory.length).toBe(2);
      expect(body.conversationHistory[0].content).toBe('previous question');
      expect(body.conversationHistory[1].content).toBe('previous answer');
      expect(body.message).toBe('new question');
    });

    it('should request text/event-stream accept header', async () => {
      fetchService.fetch.mockResolvedValue(makeSseResponse([]));

      service.sendMessage('test');
      await new Promise((r) => setTimeout(r, 0));

      const init = fetchService.fetch.mock.calls[0][1];
      expect(init.headers['Accept']).toBe('text/event-stream');
      expect(init.headers['Content-Type']).toBe('application/json');
    });

    it('should propagate error from the server', async () => {
      fetchService.fetch.mockResolvedValue(new Response('Server error', { status: 500 }));

      service.sendMessage('test');
      await new Promise((r) => setTimeout(r, 50));

      expect(store.isLoading()).toBe(false);
    });

    it('should store ai results when recipe_list event arrives', async () => {
      const recipeData = {
        id: 'abc-123',
        title: 'Test Pasta',
        difficulty: 'easy',
        spiceLevel: 2,
        durationMinutes: 30,
        servings: 4,
        additionalInformation: [],
        instructionSteps: [],
        nutrition: {},
        origin: 'Italian',
        isPublic: true,
        ingredients: [],
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      };
      const events = [
        'event: status\ndata: {"status":"thinking","detail":"Understanding..."}',
        'event: text\ndata: {"text":"Here are some recipes"}',
        `event: recipe_list\ndata: {"recipes":[${JSON.stringify(recipeData)}]}`,
      ];
      fetchService.fetch.mockResolvedValue(makeSseResponse(events));

      service.sendMessage('find pasta');
      await new Promise((r) => setTimeout(r, 50));

      const aiResults = store.aiResults();
      expect(aiResults).not.toBeNull();
      expect(aiResults!.length).toBe(1);
      expect(aiResults![0].id).toBe('abc-123');
      expect(aiResults![0].title).toBe('Test Pasta');
      expect(aiResults![0].difficulty).toBe('easy');
      expect(aiResults![0].spice_level).toBe(2);
      expect(aiResults![0].durationMinutes).toBe(30);
      expect(aiResults![0].servings).toBe(4);
    });

    it('should normalize recipe data with all required fields', async () => {
      const recipeData = {
        id: 'abc-123',
        title: 'Test Pasta',
        difficulty: 'easy',
        spiceLevel: 2,
        durationMinutes: 30,
        servings: 4,
        additionalInformation: [],
        instructionSteps: [],
        nutrition: {},
        origin: 'Italian',
        isPublic: true,
        ingredients: [],
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      };
      const events = [
        'event: status\ndata: {"status":"thinking","detail":"Understanding..."}',
        'event: text\ndata: {"text":"Here are some recipes"}',
        `event: recipe_list\ndata: {"recipes":[${JSON.stringify(recipeData)}]}`,
      ];
      fetchService.fetch.mockResolvedValue(makeSseResponse(events));

      service.sendMessage('find pasta');
      await new Promise((r) => setTimeout(r, 50));

      const msgs = store.messages();
      const lastMsg = msgs[msgs.length - 1];
      const recipes = lastMsg.additionalContent?.recipeList as any[];
      expect(recipes).toBeDefined();
      expect(recipes!.length).toBe(1);
      const recipe = recipes![0];
      expect(recipe.id).toBe('abc-123');
      expect(recipe.title).toBe('Test Pasta');
      expect(recipe.difficulty).toBe('easy');
      expect(recipe.spiceLevel).toBe(2);
      expect(recipe.durationMinutes).toBe(30);
      expect(recipe.servings).toBe(4);
      expect(recipe.origin).toBe('Italian');
      expect(Array.isArray(recipe.additionalInformation)).toBe(true);
      expect(Array.isArray(recipe.instructionSteps)).toBe(true);
      expect(Array.isArray(recipe.ingredients)).toBe(true);
      expect(typeof recipe.nutrition).toBe('object');
    });

    it('should fill defaults for missing recipe fields', async () => {
      const partialRecipe = { id: 'abc-123', title: 'Partial Recipe' };
      const events = [
        'event: status\ndata: {"status":"thinking","detail":"Understanding..."}',
        'event: text\ndata: {"text":"Here are some recipes"}',
        `event: recipe_list\ndata: {"recipes":[${JSON.stringify(partialRecipe)}]}`,
      ];
      fetchService.fetch.mockResolvedValue(makeSseResponse(events));

      service.sendMessage('find anything');
      await new Promise((r) => setTimeout(r, 50));

      const msgs = store.messages();
      const lastMsg = msgs[msgs.length - 1];
      const recipes = lastMsg.additionalContent?.recipeList as any[];
      const recipe = recipes![0];
      expect(recipe.id).toBe('abc-123');
      expect(recipe.title).toBe('Partial Recipe');
      expect(Array.isArray(recipe.instructionSteps)).toBe(true);
      expect(Array.isArray(recipe.ingredients)).toBe(true);
      expect(recipe.instructionSteps.length).toBe(0);
      expect(recipe.ingredients.length).toBe(0);
    });
  });
});
