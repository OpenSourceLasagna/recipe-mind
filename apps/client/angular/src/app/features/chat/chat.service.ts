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
import { RecipeCardDto } from '../dashboard/models/recipe-card.dto';
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
      result.set({ value: { message: null, status: null } });
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
    const isAssistantMessage = (m: any): m is ChatMessage =>
      typeof (m as ChatMessage)?.content == 'string' && (m as ChatMessage)?.role == 'assistant';
    if (!message || !isAssistantMessage(message)) {
      return;
    }
    this.#store.addMessage(message);
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
      console.warn('Failed to parse SSE JSON chunk:', fullDataStr, error);
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
          this.#store.setAiResults(this.#mapToRecipeCardDtos(normalized));
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

        case 'recipe_draft': {
          const { draft, changed_fields } = data as { draft: unknown; changed_fields: string[] };
          return {
            value: {
              ...currentStream,
              message: {
                ...currentMsg,
                additionalContent: {
                  ...currentMsg?.additionalContent,
                  recipeDraft: draft,
                  changedFields: changed_fields,
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
        const recipe = recipeContext.modifiedRecipe ?? recipeContext.originalRecipe;
        const ingredientsList =
          recipe.ingredients?.map((i: any) => i.ingredientName).join(', ') || 'None';
        const contextContent = `- Title: "${recipe.title}" (ID: ${recipe.id}) | Ingredients: [${ingredientsList}]`;

        return {
          role: 'assistant' as const,
          content: `[Context - Recipe in Chat:\n${contextContent}]`,
        };
      }

      if (!additionalContent) {
        return { role, content };
      }

      let compiledContent = content;

      if (additionalContent.recipeList && additionalContent.recipeList.length > 0) {
        const recipesBlock = additionalContent.recipeList
          .map((r: any) => {
            const ingredientsList =
              r.ingredients?.map((i: any) => i.ingredientName).join(', ') || 'None';
            return `- Title: "${r.title}" (ID: ${r.id}) | Ingredients: [${ingredientsList}]`;
          })
          .join('\n');

        compiledContent += `\n\n[Context - Displayed Recipes:\n${recipesBlock}]`;
      }

      if (additionalContent.recipeDraft) {
        const draft = additionalContent.recipeDraft as Record<string, any>;
        const fields = additionalContent.changedFields;
        let draftPayload: any = draft;

        if (fields && fields.length > 0) {
          draftPayload = {};

          for (const field of fields) {
            if (field in draft) {
              draftPayload[field] = draft[field];
            } else {
              const nestedTarget =
                draft['ingredients']?.find?.((i: any) => field in i) ||
                draft['instructions']?.find?.((step: any) => field in step);

              if (nestedTarget) {
                draftPayload[field] = nestedTarget[field];
              }
            }
          }
        }

        const draftJson = JSON.stringify(draftPayload, null, 2);
        compiledContent += `\n\n[Context - Active Recipe Draft Modifications:\n${draftJson}]`;
      }

      return {
        role,
        content: compiledContent,
      };
    });
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

  #mapToRecipeCardDtos(recipes: unknown[] | RecipeResponse[]): RecipeCardDto[] {
    return recipes.map((r: any) => ({
      id: r.id,
      title: r.title,
      difficulty: r.difficulty,
      spice_level: r.spiceLevel,
      durationMinutes: r.durationMinutes,
      servings: r.servings,
    }));
  }
}
