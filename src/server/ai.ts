import { GoogleGenAI, Type, type GenerateContentResponse } from '@google/genai';
import {
  buildGeminiHistory,
  resolveChatbotRole,
  type ChatbotRoleId,
  type GeminiHistoryEntry,
} from '../lib/aiChat.ts';

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function formatGeminiError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error || '');
  if (msg.includes('API_KEY_INVALID') || msg.includes('PERMISSION_DENIED') || msg.includes('403') || msg.includes('400')) {
    return 'Gemini API key error. Please verify GEMINI_API_KEY in Settings > Secrets.';
  }
  if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')) {
    return 'Gemini quota exceeded (429). Please wait a moment or check your quota in Settings > Secrets.';
  }
  if (msg.includes('UNAVAILABLE') || msg.includes('503') || msg.toLowerCase().includes('high demand')) {
    return 'The selected Gemini model is temporarily busy (503). Please retry in a few seconds or switch to Quick Lookup.';
  }
  if (msg.includes('NOT_FOUND') || msg.includes('404')) {
    return 'Requested Gemini model was not found. Please contact support to verify active model configuration.';
  }
  if (msg.startsWith('{')) {
    try {
      const outer = JSON.parse(msg);
      const innerMsg = outer?.error?.message;
      if (typeof innerMsg === 'string') {
        if (innerMsg.trim().startsWith('{')) {
          const inner = JSON.parse(innerMsg);
          if (typeof inner?.error?.message === 'string') {
            return inner.error.message;
          }
        }
        return innerMsg;
      }
    } catch {
      // fall through
    }
  }
  return msg || 'AI service could not complete the request.';
}

export async function runMultiTurnChat(params: {
  message: string;
  history?: GeminiHistoryEntry[];
  chatbotRole?: ChatbotRoleId | string;
  contextSummary: string;
  language?: string;
}) {
  const ai = getAiClient();
  if (!ai) {
    throw new Error(
      'GEMINI_API_KEY is not configured in Settings > Secrets. Please set a valid Gemini API key to use the BuildMate AI chatbot.'
    );
  }

  const roleConfig = resolveChatbotRole(params.chatbotRole);
  const langInstruction =
    params.language === 'ta'
      ? 'Respond in Tamil (தமிழ்) while keeping standard English/metric engineering codes (e.g., sq.mm, MCB, RCCB, CPVC, UPVC, INR, GST) clear.'
      : 'Respond in clear Indian construction English.';

  const systemInstruction = `${roleConfig.systemInstruction}\n\n${langInstruction}\n\nBuildMate Live Database Context:\n${params.contextSummary}`;

  const chat = ai.chats.create({
    model: roleConfig.model,
    history: params.history || [],
    config: {
      systemInstruction,
    },
  });

  try {
    const response: GenerateContentResponse = await chat.sendMessage({
      message: params.message,
    });

    return {
      answer: response.text || 'No response generated.',
      modelUsed: roleConfig.model,
      roleId: roleConfig.id,
      disclaimer:
        'AI guidance is informational only. Verify specifications and quantities against approved drawings and qualified professionals.',
    };
  } catch (error) {
    throw new Error(formatGeminiError(error));
  }
}

export async function streamMultiTurnChat(params: {
  message: string;
  history?: GeminiHistoryEntry[];
  chatbotRole?: ChatbotRoleId | string;
  contextSummary: string;
  language?: string;
  onChunk: (chunkText: string) => void;
}) {
  const ai = getAiClient();
  if (!ai) {
    throw new Error(
      'GEMINI_API_KEY is not configured in Settings > Secrets. Please set a valid Gemini API key to use the BuildMate AI chatbot.'
    );
  }

  const roleConfig = resolveChatbotRole(params.chatbotRole);
  const langInstruction =
    params.language === 'ta'
      ? 'Respond in Tamil (தமிழ்) while keeping standard English/metric engineering codes (e.g., sq.mm, MCB, RCCB, CPVC, UPVC, INR, GST) clear.'
      : 'Respond in clear Indian construction English.';

  const systemInstruction = `${roleConfig.systemInstruction}\n\n${langInstruction}\n\nBuildMate Live Database Context:\n${params.contextSummary}`;

  const chat = ai.chats.create({
    model: roleConfig.model,
    history: params.history || [],
    config: {
      systemInstruction,
    },
  });

  try {
    const streamResponse = await chat.sendMessageStream({
      message: params.message,
    });

    let fullText = '';
    for await (const chunk of streamResponse) {
      const c = chunk as GenerateContentResponse;
      if (c.text) {
        fullText += c.text;
        params.onChunk(c.text);
      }
    }

    return {
      answer: fullText || 'No response generated.',
      modelUsed: roleConfig.model,
      roleId: roleConfig.id,
      disclaimer:
        'AI guidance is informational only. Verify specifications and quantities against approved drawings and qualified professionals.',
    };
  } catch (error) {
    throw new Error(formatGeminiError(error));
  }
}

export async function askMaterialAssistant(params: {
  question: string;
  mode: 'assistant' | 'support' | 'compare';
  contextSummary: string;
  history?: Array<{ role: 'user' | 'assistant'; text: string; isError?: boolean }>;
  chatbotRole?: ChatbotRoleId | string;
  language?: string;
}) {
  if (params.mode === 'compare') {
    const ai = getAiClient();
    if (!ai) {
      throw new Error(
        'GEMINI_API_KEY is not configured in Settings > Secrets. Please set a valid Gemini API key to use AI assistants.'
      );
    }

    const systemInstruction =
      'You are BuildMate AI Quotation Assistant for an Indian electrical & plumbing marketplace. Explain differences between the provided real supplier quotations (brands, specifications, delivery charges, lead times, GST, and availability) factually and neutrally. Never recommend a supplier solely because its price is lowest. Never invent prices or availability not present in the provided data.';

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Context from BuildMate Database:\n${params.contextSummary}\n\nUser Question:\n${params.question}`,
        config: {
          systemInstruction,
        },
      });

      return {
        answer: response.text || 'No response generated.',
        modelUsed: 'gemini-4-hydrogen',
        disclaimer:
          'AI guidance is informational only. Verify specifications and quantities against approved drawings and qualified professionals.',
      };
    } catch (error) {
      throw new Error(formatGeminiError(error));
    }
  }

  const resolvedRole: ChatbotRoleId =
    params.chatbotRole && params.chatbotRole in { material_advisor: 1, boq_planner: 1, platform_support: 1, quick_lookup: 1 }
      ? (params.chatbotRole as ChatbotRoleId)
      : params.mode === 'support'
        ? 'platform_support'
        : 'material_advisor';

  return runMultiTurnChat({
    message: params.question,
    history: buildGeminiHistory(params.history || []),
    chatbotRole: resolvedRole,
    contextSummary: params.contextSummary,
    language: params.language,
  });
}

export async function generateDraftChecklist(params: {
  projectType: string;
  approxAreaSqft: number;
  numFloors: number;
  domain: 'electrical' | 'plumbing' | 'both';
  notes: string;
  catalogCatalogSummary: string;
}) {
  const ai = getAiClient();
  if (!ai) {
    throw new Error(
      'GEMINI_API_KEY is not configured in Settings > Secrets. Please set a valid Gemini API key to generate AI draft checklists.'
    );
  }

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Project Type: ${params.projectType}
Approximate Area: ${params.approxAreaSqft} sq.ft
Floors: ${params.numFloors}
Focus Domain: ${params.domain}
User Notes: ${params.notes || 'Standard residential/commercial setup'}

Available BuildMate Catalogue Products (use matching productId/sku when applicable, do NOT invent prices—use exact estimatedPrice from list or 0 for custom):
${params.catalogCatalogSummary}

Generate a draft material checklist of 6 to 12 practical items for planning. Mark every quantity strictly as a rough planning estimate requiring engineer/drawings verification.`,
    config: {
      systemInstruction:
        'You are BuildMate AI Material List Assistant. Output structured JSON checklist items grounded in the provided catalogue. Never claim exact quantities without construction drawings.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          disclaimer: { type: Type.STRING },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                sku: { type: Type.STRING },
                productName: { type: Type.STRING },
                domain: { type: Type.STRING },
                categoryName: { type: Type.STRING },
                brand: { type: Type.STRING },
                specification: { type: Type.STRING },
                unit: { type: Type.STRING },
                estimatedQuantity: { type: Type.NUMBER },
                rationale: { type: Type.STRING },
              },
            },
          },
        },
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '{}').trim() || '{}');
  return {
    disclaimer:
      parsed.disclaimer ||
      'AI-GENERATED ESTIMATE: These quantities are rough planning drafts based on project description only. Verify exact quantities from MEP construction drawings and a qualified electrician/plumber before ordering.',
    items: Array.isArray(parsed.items) ? parsed.items : [],
  };
}

export async function aiNaturalProductSearch(params: {
  query: string;
  catalogSummary: string;
}) {
  const ai = getAiClient();
  if (!ai) {
    throw new Error(
      'GEMINI_API_KEY is not configured in Settings > Secrets. Standard keyword search remains available.'
    );
  }

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `User Search Query: "${params.query}"\n\nCatalog Items:\n${params.catalogSummary}\n\nReturn the matching SKUs from the catalog ranked by relevance and a brief explanation.`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          skus: { type: Type.ARRAY, items: { type: Type.STRING } },
          explanation: { type: Type.STRING },
        },
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '{}').trim() || '{}');
  return {
    skus: Array.isArray(parsed.skus) ? parsed.skus : [],
    explanation: parsed.explanation || '',
  };
}
