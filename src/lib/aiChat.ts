export type ChatbotRoleId =
  | 'material_advisor'
  | 'boq_planner'
  | 'platform_support'
  | 'quick_lookup';

export interface ChatbotMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  chatbotRole?: ChatbotRoleId;
  modelUsed?: string;
  disclaimer?: string;
  isError?: boolean;
}

export interface ChatbotRoleConfig {
  id: ChatbotRoleId;
  label: string;
  shortLabel: string;
  model: 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite';
  description: string;
  systemInstruction: string;
  starterPrompts: string[];
}

export const CHATBOT_ROLES: Record<ChatbotRoleId, ChatbotRoleConfig> = {
  material_advisor: {
    id: 'material_advisor',
    label: 'Material & MEP Advisor',
    shortLabel: 'Material Advisor',
    model: 'gemini-4-hydrogen',
    description:
      'Detailed technical guidance on Indian electrical & plumbing specifications, IS/ASTM ratings, and brand compatibility.',
    systemInstruction:
      'You are BuildMate Material & MEP Advisor for Indian electrical and plumbing construction. Help electricians, plumbers, contractors, and homeowners select compatible materials using Indian standards (IS 694 FR-LSH copper wires, MCB/RCCB trip curves & mA ratings, CPVC vs UPVC vs SWR pipe schedules, earthing kits, and pumps). Ground product suggestions in the provided BuildMate database context whenever available without inventing market prices. Keep responses structured and concise, and remind users to confirm final quantities and specs with qualified electricians, plumbers, or MEP engineers and approved site drawings.',
    starterPrompts: [
      'Which copper wire gauge is right for a 1.5-ton AC vs lighting circuits?',
      'Compare CPVC SDR 11 vs UPVC Schedule 40 for residential plumbing.',
      'Explain when to use a 30mA RCCB alongside SP MCBs.',
    ],
  },
  boq_planner: {
    id: 'boq_planner',
    label: 'Project & BOQ Planner',
    shortLabel: 'BOQ Planner',
    model: 'gemini-4-hydrogen',
    description:
      'Multi-turn project material planning for new houses, apartments, shops, and commercial buildings.',
    systemInstruction:
      'You are BuildMate Project & BOQ Planner. Guide customers, electricians, plumbers, and contractors step-by-step across multiple turns to plan electrical and plumbing material lists for Indian construction projects (2BHK/3BHK houses, apartments, commercial shops, renovations). Ask clarifying questions when floor count, bathroom count, or built-up area is missing. Clearly label any suggested quantities as rough planning estimates requiring approved MEP drawings before placing supplier orders.',
    starterPrompts: [
      'Help me plan electrical & plumbing materials for a 1,500 sq.ft 2-floor house.',
      'What details do you need to estimate bathroom plumbing pipes and fittings?',
      'Review my current Material List items and suggest anything commonly missed.',
    ],
  },
  platform_support: {
    id: 'platform_support',
    label: 'Platform & Quote Support',
    shortLabel: 'Platform Support',
    model: 'gemini-4-hydrogen',
    description:
      'Step-by-step help with Material List Builder, GST PDF quotations, multi-shop RFQs, quote comparison, and orders.',
    systemInstruction:
      'You are BuildMate Platform Support Assistant. Answer questions clearly and accurately about how to use BuildMate: creating projects, using Mode A (catalogue selection) and Mode B (manual custom material entry), downloading B2B GST estimate PDFs, finding verified suppliers by PIN code, sending one requirement to multiple shops, comparing quotes side-by-side, splitting orders across suppliers, and tracking deliveries/payments.',
    starterPrompts: [
      'How do I send the same material list to multiple local shops?',
      'Can I split an order between an electrical shop and a plumbing shop?',
      'How do I download a GST-ready PDF quotation?',
    ],
  },
  quick_lookup: {
    id: 'quick_lookup',
    label: 'Quick Spec & GST Lookup (Fast)',
    shortLabel: 'Quick Lookup',
    model: 'gemini-3.1-flash-lite',
    description:
      'Fast, ultra-concise answers for unit conversions, pipe diameters, HSN/GST norms, and catalogue lookups.',
    systemInstruction:
      'You are BuildMate Quick Lookup Assistant. Give ultra-concise, direct bullet-point answers (under 120 words) for quick unit conversions (coil lengths, mm-to-inch pipe equivalents), typical GST slabs on electrical/plumbing materials in India, and quick catalogue lookups from the provided context.',
    starterPrompts: [
      'Convert 25mm, 32mm, and 40mm pipe sizes to inches.',
      'Standard coil length of house wiring cables in India?',
      'Typical GST rate for MCBs, copper wires, and CPVC pipes?',
    ],
  },
};

export function resolveChatbotRole(roleId?: string): ChatbotRoleConfig {
  if (roleId && roleId in CHATBOT_ROLES) {
    return CHATBOT_ROLES[roleId as ChatbotRoleId];
  }
  return CHATBOT_ROLES.material_advisor;
}

export interface GeminiHistoryEntry {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

/**
 * Converts client chat messages into Gemini `ai.chats.create` history entries:
 * - Drops error messages, empty messages, and any leading assistant greeting
 *   so history begins cleanly with a user turn when non-empty.
 * - Caps history length to the last 20 turns to bound token usage.
 */
export function buildGeminiHistory(
  messages: Array<{ role: 'user' | 'assistant'; text: string; isError?: boolean }>
): GeminiHistoryEntry[] {
  const valid = messages
    .filter((m) => !m.isError && typeof m.text === 'string' && m.text.trim().length > 0)
    .map((m) => ({
      role: (m.role === 'assistant' ? 'model' : 'user') as 'user' | 'model',
      parts: [{ text: m.text.trim() }],
    }));

  // Ensure history starts with a 'user' turn if non-empty
  while (valid.length > 0 && valid[0].role !== 'user') {
    valid.shift();
  }

  // Keep the most recent 20 turns (and still ensure first is 'user')
  const sliced = valid.slice(-20);
  while (sliced.length > 0 && sliced[0].role !== 'user') {
    sliced.shift();
  }
  return sliced;
}
