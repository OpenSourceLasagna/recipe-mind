import { ChatMessage } from './chat-message.model';

export interface ChatRequest {
  message: string;
  conversationHistory: Pick<ChatMessage, 'role' | 'content'>[];
  currentRecipeId?: string | null;
}
