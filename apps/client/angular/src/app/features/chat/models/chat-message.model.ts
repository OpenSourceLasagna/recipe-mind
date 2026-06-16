import { Recipe } from '../../dashboard/models/recipe.model';

export type ChatRole = 'user' | 'assistant';

export interface MessageAdditionalContent {
  recipeList?: Recipe[];
  recipeDraft?: Recipe;
  changedFields?: string[];
}

export interface PendingMessageAdditionalContent {
  recipeList?: unknown[];
  recipeDraft?: unknown;
  changedFields?: string[];
}

export interface ChatMessage {
  readonly id: number;
  readonly role: ChatRole;
  readonly content: string;
  readonly additionalContent?: MessageAdditionalContent;
}

export interface PendingChatMessage extends Omit<Partial<ChatMessage>, 'additionalContent'> {
  additionalContent?: PendingMessageAdditionalContent;
}

export type PanelChatMessage =
  | (PendingChatMessage & { id: number; isPending: true })
  | (ChatMessage & { isPending?: false });
