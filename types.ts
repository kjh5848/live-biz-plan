export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface ReviewFinding {
  type: 'weakness' | 'missing' | 'verification';
  content: string;
}

export interface SectionMeta {
  id: string; // usually the heading text
  editedAt: number;
  locked: boolean;
}

export interface DocumentState {
  markdown: string;
  json: any; // TipTap JSON
  sections: SectionMeta[];
  lastUpdated: number;
}

export type EditorMode = 'render' | 'raw' | 'notion';

export interface ChatResponse {
  assistantMessage: string;
  updatedDocumentMarkdown: string;
  reviewFindings: ReviewFinding[];
  nextQuestion: string;
}