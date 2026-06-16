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
  });
});
