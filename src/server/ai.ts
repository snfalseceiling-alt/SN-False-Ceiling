import { GoogleGenAI, Type } from '@google/genai';

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

export async function askMaterialAssistant(params: {
  question: string;
  mode: 'assistant' | 'support' | 'compare';
  contextSummary: string;
}) {
  const ai = getAiClient();
  if (!ai) {
    throw new Error(
      'GEMINI_API_KEY is not configured in Settings > Secrets. Please set a valid Gemini API key to use AI assistants.'
    );
  }

  const systemInstruction =
    params.mode === 'compare'
      ? 'You are BuildMate AI Quotation Assistant for an Indian electrical & plumbing marketplace. Explain differences between the provided real supplier quotations (brands, specifications, delivery charges, lead times, GST, and availability) factually and neutrally. Never recommend a supplier solely because its price is lowest. Never invent prices or availability not present in the provided data.'
      : params.mode === 'support'
        ? 'You are BuildMate AI Support Assistant. Answer platform questions about creating projects, building material lists, requesting multi-shop quotations, comparing supplier bids, PDF generation, and order tracking in India concisely and accurately.'
        : 'You are BuildMate AI Material Assistant for Indian electrical & plumbing construction. Explain product categories, IS/ASTM standards (e.g., CPVC vs UPVC, FR-LSH copper wire gauges, MCB vs RCCB), and compatibility using only the provided catalog context where applicable. Always remind users to verify technical selections with qualified electricians, plumbers, or MEP engineers.';

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Context from BuildMate Database:\n${params.contextSummary}\n\nUser Question:\n${params.question}`,
    config: {
      systemInstruction,
    },
  });

  return {
    answer: response.text || 'No response generated.',
    disclaimer:
      'AI guidance is informational only. Verify specifications and quantities against approved drawings and qualified professionals.',
  };
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
