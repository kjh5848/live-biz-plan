import { GoogleGenAI } from "@google/genai";
import { ChatResponse, Message, SectionMeta } from "../types";
import { DOC_WRITER_PROMPT, DOC_REVIEWER_PROMPT, NEXT_QUESTION_PROMPT } from "../constants";

// Helper to get fresh AI instance
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function processChatAndDoc(
  messages: Message[],
  currentMarkdown: string,
  sectionsMeta: SectionMeta[]
): Promise<ChatResponse> {
  const ai = getAI();
  const lastUserMessage = messages[messages.length - 1].content;
  
  // 1. Identify Locked Sections (edited recently)
  // For this demo, we assume sections edited in the last 2 minutes are 'locked' from AI major rewrites
  // Reduced from 5 to 2 minutes to make it easier for AI to help after user adds a section.
  const lockedSections = sectionsMeta
    .filter(s => s.locked || (Date.now() - s.editedAt < 1000 * 60 * 2 && s.editedAt > 0))
    .map(s => s.id);

  // 2. Generate Updated Document
  const updatePrompt = `
    ${DOC_WRITER_PROMPT}

    CURRENT DOCUMENT:
    ${currentMarkdown}

    USER INPUT:
    ${lastUserMessage}

    LOCKED SECTIONS (Do not change content under these headings):
    ${JSON.stringify(lockedSections)}
  `;

  let updatedMarkdown = currentMarkdown;
  try {
    const docResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: updatePrompt,
    });
    if (docResponse.text) {
        updatedMarkdown = docResponse.text;
    }
  } catch (e) {
    console.error("Doc update failed", e);
  }

  // 3. Review Findings (Parallel)
  let findings = [];
  try {
    const reviewResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `${DOC_REVIEWER_PROMPT}\n\nDocument:\n${updatedMarkdown}`,
      config: { responseMimeType: "application/json" }
    });
    const text = reviewResponse.text;
    if (text) {
        findings = JSON.parse(text);
    }
  } catch (e) {
    console.error("Review failed", e);
  }

  // 4. Next Question & Assistant Message (Parallel)
  let assistantMessage = "문서를 업데이트했습니다. 확인해보세요.";
  let nextQuestion = "";
  
  try {
      const chat = ai.chats.create({ model: 'gemini-3-flash-preview' });
      // Feed some context
      const chatPrompt = `
      You are a helpful business consultant.
      The user just said: "${lastUserMessage}".
      You have updated the document.
      Give a very brief, encouraging response (1-2 sentences) confirming the update.
      Then, assume the role of the NextQuestion generator.
      `;
      
      const msgResponse = await chat.sendMessage({ message: chatPrompt });
      if (msgResponse.text) assistantMessage = msgResponse.text;

      const qResponse = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `${NEXT_QUESTION_PROMPT}\n\nDocument:\n${updatedMarkdown}\nUser Input: ${lastUserMessage}`
      });
      if (qResponse.text) nextQuestion = qResponse.text;

  } catch (e) {
      console.error("Chat/Question failed", e);
  }

  return {
    assistantMessage,
    updatedDocumentMarkdown: updatedMarkdown,
    reviewFindings: findings,
    nextQuestion
  };
}