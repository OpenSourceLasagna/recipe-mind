import {
  inject,
  Injectable,
  resource,
  ResourceStreamItem,
  signal,
  WritableSignal,
} from '@angular/core';
import { environment } from '../../../environments/environment';
import { ChatStore } from './chat.store';
import { ChatRequest } from './models/chat-request.model';
import { ChatMessage, PendingChatMessage } from './models/chat-message.model';
import { FetchService } from '../../core/services/fetch.service';
import { RecipeResponse } from '../dashboard/models/recipe.model';

type MessageStream = {
  message: PendingChatMessage | null;
  status: { status: string; detail?: string } | null;
};

@Injectable({ providedIn: 'root' })
export class ChatService {
  readonly #store = inject(ChatStore);
  readonly #fetchService = inject(FetchService);
  readonly #baseUrl = new URL('v1/ai-chef', environment.apiUrl).toString();
  readonly #query = signal<ChatRequest | null>(null);

  readonly #stream = resource({
    params: this.#query,
    stream: async ({ params, abortSignal }) => {
      const result = signal<ResourceStreamItem<MessageStream>>({
        value: { message: null, status: null },
      });
      if (!params) return result;
      this.#startStreaming(params, abortSignal, result);
      return result;
    },
  });

  readonly stream = this.#stream.asReadonly();

  async #startStreaming(
    params: ChatRequest,
    abortSignal: AbortSignal,
    result: WritableSignal<ResourceStreamItem<MessageStream>>,
  ): Promise<void> {
    this.#store.setLoading(true);
    try {
      const response = await this.#fetchService.fetch(`${this.#baseUrl}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(params),
        signal: abortSignal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => 'Request failed');
        throw new Error(body);
      }

      await this.handleResponse(response, result);

      const finalResult = result();
      if ('value' in finalResult && finalResult.value.message != null) {
        this.finalizeMessage(finalResult.value.message);
      }
    } catch (err) {
      if (!abortSignal.aborted) {
        result.set({
          value: { message: null, status: null },
          error: err instanceof Error ? err : new Error(String(err)),
        });
      }
    } finally {
      const current = result();
      if (!('error' in current)) {
        result.set({ value: { message: null, status: null } });
      }
      this.#store.setLoading(false);
    }
  }

  sendMessage(text: string): void {
    if (!text.trim()) return;

    const history = this.getTransformedHistory();
    this.#store.addMessage({ role: 'user', content: text.trim() });
    this.#store.setLoading(true);

    this.#query.set({
      message: text.trim(),
      conversationHistory: history,
    });
  }

  private finalizeMessage(message: PendingChatMessage) {
    if (!message || typeof message.content !== 'string' || message.role !== 'assistant') {
      return;
    }
    this.#store.addMessage(message as ChatMessage);
  }

  private async handleResponse(
    response: Response,
    result: WritableSignal<ResourceStreamItem<MessageStream>>,
  ): Promise<void> {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let accumulatedText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() ?? '';

      for (const block of blocks) {
        const event = this.parseSseBlock(block);
        if (!event) {
          continue;
        }

        if (event.type === 'text_delta') {
          accumulatedText += (event.data as { delta: string }).delta;
        } else if (event.type === 'text') {
          accumulatedText = (event.data as { text: string }).text;
        }

        this.handleEvent(event.type, event.data, accumulatedText, result);
      }
    }
  }

  private parseSseBlock(block: string): { type: string; data: unknown } | null {
    if (!block.trim()) return null;

    const lines = block.split('\n');
    let type = '';

    const dataLines: string[] = [];

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      if (trimmedLine.startsWith('event:')) {
        type = trimmedLine.slice(6).trim();
      } else if (trimmedLine.startsWith('data:')) {
        dataLines.push(trimmedLine.slice(5).trim());
      }
    }

    if (!type && dataLines.length > 0) {
      type = 'message';
    }

    if (!type || dataLines.length === 0) return null;

    const fullDataStr = dataLines.join('\n');

    try {
      return { type, data: JSON.parse(fullDataStr) };
    } catch (error) {
      console.warn('Failed to parse SSE JSON chunk:', error);
      return null;
    }
  }

  private handleEvent(
    type: string,
    data: unknown,
    accumulatedText: string,
    result: WritableSignal<ResourceStreamItem<MessageStream>>,
  ): void {
    if (type === 'error') {
      const { error } = data as { error: string };
      result.set({ error: new Error(error) });
      this.#store.setLoading(false);
      return;
    }

    const currentItem = result();
    if (!('value' in currentItem)) return;

    const currentStream = currentItem.value;
    const currentMsg = currentStream.message;

    if (type === 'recipe_draft') {
      const { draft, changed_fields } = data as { draft: unknown; changed_fields: string[] };
      const normalizedDraft = this.#normalizeRecipe(draft);
      this.#store.setAiDraft(normalizedDraft.id, normalizedDraft, changed_fields);
      result.update(() => ({
        value: {
          ...currentStream,
          message: {
            ...currentMsg,
            additionalContent: {
              ...currentMsg?.additionalContent,
              recipeDraft: normalizedDraft,
              changedFields: changed_fields,
            },
          },
        },
      }));
      return;
    }

    result.update(() => {
      switch (type) {
        case 'text':
        case 'text_delta':
          return {
            value: {
              ...currentStream,
              message: {
                ...currentMsg,
                role: 'assistant',
                content: accumulatedText,
              },
            },
          };

        case 'status':
          return {
            value: {
              ...currentStream,
              status: data as { status: string; detail: string },
            },
          };

        case 'recipe_list': {
          const { recipes } = data as { recipes: unknown[] };
          const normalized = recipes.map((r) => this.#normalizeRecipe(r));
          return {
            value: {
              ...currentStream,
              message: {
                ...currentMsg,
                additionalContent: {
                  ...currentMsg?.additionalContent,
                  recipeList: normalized,
                },
              },
            },
          };
        }
        default:
          return currentItem;
      }
    });
  }

  private getTransformedHistory(): ChatRequest['conversationHistory'] {
    return this.#store.messages().map(({ role, content, additionalContent, recipeContext }) => {
      if (role === 'recipe' && recipeContext) {
        return {
          role: 'assistant' as const,
          content: this.#formatRecipeContext(recipeContext),
        };
      }

      if (!additionalContent) {
        return { role, content };
      }

      const parts = [content];

      const listBlock = this.#formatRecipeListContext(additionalContent);
      if (listBlock) parts.push(listBlock);

      const draftBlock = this.#formatDraftContext(additionalContent);
      if (draftBlock) parts.push(draftBlock);

      return {
        role,
        content: parts.filter(Boolean).join('\n\n'),
      };
    });
  }

  #formatRecipeContext(recipeContext: ChatMessage['recipeContext']): string {
    const recipe = recipeContext!.modifiedRecipe ?? recipeContext!.originalRecipe;
    const ingredientsList = recipe.ingredients?.map((i) => i.ingredientName).join(', ') || 'None';
    const contextContent = `- Title: "${recipe.title}" (ID: ${recipe.id}) | Ingredients: [${ingredientsList}]`;
    return `[Context - Recipe in Chat:\n${contextContent}]`;
  }

  #formatRecipeListContext(additionalContent: ChatMessage['additionalContent']): string | null {
    if (!additionalContent?.recipeList?.length) return null;

    const recipesBlock = additionalContent.recipeList
      .map((r) => {
        const ingredientsList = r.ingredients?.map((i) => i.ingredientName).join(', ') || 'None';
        return `- Title: "${r.title}" (ID: ${r.id}) | Ingredients: [${ingredientsList}]`;
      })
      .join('\n');

    return `[Context - Displayed Recipes:\n${recipesBlock}]`;
  }

  #formatDraftContext(additionalContent: ChatMessage['additionalContent']): string | null {
    if (!additionalContent?.recipeDraft) return null;

    const draft = additionalContent.recipeDraft as unknown as Record<string, unknown>;
    const fields = additionalContent.changedFields;
    let draftPayload: Record<string, unknown> = draft;

    if (fields && fields.length > 0) {
      draftPayload = {};
      for (const field of fields) {
        if (field in draft) {
          draftPayload[field] = draft[field];
        } else {
          const ingredients = Array.isArray(draft['ingredients'])
            ? (draft['ingredients'] as Record<string, unknown>[])
            : null;
          const nestedTarget = ingredients?.find((i) => field in i) ?? null;
          if (nestedTarget) {
            draftPayload[field] = nestedTarget[field];
          }
        }
      }
    }

    return `[Context - Active Recipe Draft Modifications:\n${JSON.stringify(draftPayload, null, 2)}]`;
  }

  #normalizeRecipe(raw: unknown): RecipeResponse {
    const r = raw as Record<string, unknown> | null | undefined;
    return {
      id: String(r?.['id'] ?? ''),
      title: String(r?.['title'] ?? ''),
      additionalInformation: Array.isArray(r?.['additionalInformation'])
        ? (r!['additionalInformation'] as string[])
        : [],
      instructionSteps: Array.isArray(r?.['instructionSteps'])
        ? (r!['instructionSteps'] as string[])
        : [],
      nutrition: (r?.['nutrition'] as Record<string, unknown>) ?? {},
      servings: typeof r?.['servings'] === 'number' ? (r!['servings'] as number) : 0,
      durationMinutes:
        typeof r?.['durationMinutes'] === 'number' ? (r!['durationMinutes'] as number) : 0,
      difficulty: (r?.['difficulty'] as RecipeResponse['difficulty']) ?? 'easy',
      spiceLevel: typeof r?.['spiceLevel'] === 'number' ? (r!['spiceLevel'] as number) : 0,
      origin: String(r?.['origin'] ?? ''),
      isPublic: Boolean(r?.['isPublic']),
      ingredients: Array.isArray(r?.['ingredients'])
        ? (r!['ingredients'] as RecipeResponse['ingredients'])
        : [],
      createdAt: String(r?.['createdAt'] ?? ''),
      updatedAt: String(r?.['updatedAt'] ?? ''),
    } satisfies RecipeResponse;
  }
}
