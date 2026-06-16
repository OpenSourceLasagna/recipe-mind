export interface SseStatusData {
  status: string;
  detail: string;
}

export interface SseTextDeltaData {
  delta: string;
}

export interface SseTextData {
  text: string;
}

export interface SseErrorData {
  error: string;
  code: string;
}

export interface SseRecipeListData {
  recipes: unknown[];
}

export interface SseRecipeDraftData {
  draft: unknown;
  changed_fields: string[];
}
