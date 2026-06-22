import { RecipeResponse } from '../../dashboard/models/recipe.model';

export type ChatRole = 'user' | 'assistant' | 'recipe';

export interface RecipeContext {
  originalRecipe: RecipeResponse;
  modifiedRecipe?: RecipeResponse;
  changedFields?: string[];
  isActive: boolean;
  isEditing: boolean;
  startInModifiedMode?: boolean;
}

export interface MessageAdditionalContent {
  recipeList?: RecipeResponse[];
  recipeDraft?: RecipeResponse;
  changedFields?: string[];
}

export type PendingMessageAdditionalContent = MessageAdditionalContent;

export interface ChatMessage {
  readonly id: number;
  readonly role: ChatRole;
  readonly content: string;
  readonly additionalContent?: MessageAdditionalContent;
  readonly recipeContext?: RecipeContext;
}

export interface PendingChatMessage extends Omit<Partial<ChatMessage>, 'additionalContent'> {
  additionalContent?: PendingMessageAdditionalContent;
}

export type PanelChatMessage =
  | (PendingChatMessage & { id: number; isPending: true })
  | (ChatMessage & { isPending?: false });
