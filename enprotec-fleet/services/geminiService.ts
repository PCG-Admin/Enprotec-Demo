import { GoogleGenAI } from "@google/genai";
import { WorkflowRequest, StockItem } from '../types';

// Resolve API key at runtime so deployments can supply either VITE_GEMINI_API_KEY or GEMINI_API_KEY.
const getApiKey = (): string | undefined => {
  const metaEnv = (import.meta as any)?.env || {};
  return (
    metaEnv.VITE_GEMINI_API_KEY ||
    metaEnv.GEMINI_API_KEY ||
    (typeof window !== 'undefined' ? (window as any).GEMINI_API_KEY : undefined) ||
    (typeof process !== 'undefined' ? (process as any).env?.GEMINI_API_KEY : undefined) ||
    (typeof process !== 'undefined' ? (process as any).env?.API_KEY : undefined)
  );
};

export const aiAvailable = () => !!getApiKey();

const getClient = (): GoogleGenAI | null => {
  const key = getApiKey();
  if (!key) return null;
  return new GoogleGenAI({ apiKey: key });
};

const extractText = (result: any): string | null => {
  // Try helper
  const resp = result?.response ?? result;
  if (resp && typeof resp.text === 'function') {
    const txt = resp.text();
    if (txt) return txt;
  }
  // Try legacy property
  if (typeof resp?.text === 'string' && resp.text.length > 0) {
    return resp.text;
  }
  // Stitch candidate parts
  const parts = resp?.candidates?.[0]?.content?.parts ?? [];
  const stitched = parts.map((p: any) => p?.text || '').join(' ').trim();
  return stitched || null;
};

export const generateReportSummary = async (workflows: WorkflowRequest[], stock: StockItem[]): Promise<string> => {
  const ai = getClient();
  if (!ai) {
    return "This feature is currently unavailable.";
  }

  const prompt = `
    Analyze the following industrial operations data and provide a concise summary for an operations manager.
    Focus on key metrics, potential risks (like critical stock levels), and overall workflow status.

    **Current Workflow Requests:**
    ${JSON.stringify(workflows.map(w => ({
      requestNumber: w.requestNumber,
      type: w.type,
      status: w.currentStatus,
      priority: w.priority,
      items: w.items.length
    })), null, 2)}

    **Current Stock Levels:**
    ${JSON.stringify(stock.map(s => ({
      partNumber: s.partNumber,
      description: s.description,
      onHand: s.quantityOnHand,
      minLevel: s.minStockLevel,
      isCritical: s.quantityOnHand < s.minStockLevel
    })), null, 2)}

    Generate a summary highlighting:
    1. The number of active workflows and their general status.
    2. Any critical or high-priority requests that need attention.
    3. Any stock items that are below their minimum level (critically low stock).
    4. A brief conclusion on the current operational health.
  `;

  try {
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    const text = extractText(result);
    return text || "No AI response was returned.";
  } catch (error) {
    console.error("AI summary error:", error);
    return "We couldn't generate a summary right now. Please try again later.";
  }
};

export const askStockQuestion = async (
  question: string,
  context: { receipts: any[]; issues: any[] }
): Promise<string> => {
  const ai = getClient();
  if (!ai) {
    return "This feature is currently unavailable.";
  }

  const prompt = `
  You are an assistant answering operational inventory questions.
  Use ONLY the supplied JSON data to answer concisely.

  Receipts (inbound):
  ${JSON.stringify(context.receipts, null, 2)}

  Outbound / Issues:
  ${JSON.stringify(context.issues, null, 2)}

  Question: "${question}"
  Return a short, factual answer. If the data is insufficient, say so.
  `;

  try {
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    const text = extractText(result);
    return text || "No AI response was returned.";
  } catch (error) {
    console.error("AI Q&A error:", error);
    return "We couldn't generate an answer right now. Please try again later.";
  }
};
