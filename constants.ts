import { SectionMeta } from './types';

export const INITIAL_SECTIONS = [
  "한 줄 요약",
  "문제",
  "해결책",
  "고객/타겟",
  "시장 가설",
  "경쟁/대안",
  "제품/핵심 기능",
  "수익 모델",
  "마케팅/유통 전략",
  "운영/실행 계획",
  "팀",
  "재무 가정/지표",
  "로드맵",
  "리스크/대응",
  "핵심 KPI"
];

// Start with only the first section for the step-by-step flow
export const INITIAL_MARKDOWN = `# ${INITIAL_SECTIONS[0]}\n\n`;

export const INITIAL_SECTION_META: SectionMeta[] = [{
  id: INITIAL_SECTIONS[0],
  editedAt: 0,
  locked: false
}];

export const DOC_WRITER_PROMPT = `
You are an expert Business Plan Consultant and Writer.
Your task is to update a business plan document based on the current document content and the user's latest input.

RULES:
1. Maintain the existing Section Headings EXACTLY. Do not add or remove top-level headings unless explicitly asked.
2. Only update the content within the sections that are relevant to the user's input.
3. If a section is marked as [LOCKED] in the context provided, DO NOT modify it.
4. Use professional, concise, and persuasive business language.
5. Return the full updated Markdown document.
`;

export const DOC_REVIEWER_PROMPT = `
Analyze the business plan and identify up to 5 critical weaknesses, missing information, or verification points.
Return the result as a JSON array of objects with 'type' (weakness/missing/verification) and 'content'.
`;

export const NEXT_QUESTION_PROMPT = `
Based on the current state of the business plan and the conversation, generate the SINGLE most important next question to ask the user to further develop the plan.
`;