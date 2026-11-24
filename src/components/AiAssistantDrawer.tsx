import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MessageSquare, RotateCcw, Send, Sparkles, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  CHATBOT_ROLES,
  type ChatbotMessage,
  type ChatbotRoleId,
} from '../lib/aiChat';

function renderInlineSegments(text: string, isUser: boolean): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className={isUser ? 'font-semibold text-white' : 'font-semibold text-[#0F2942]'}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={idx}
          className={`px-1 py-0.5 rounded font-mono text-[11px] ${
            isUser ? 'bg-white/15 text-white' : 'bg-slate-200/80 text-[#0F2942]'
          }`}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

function FormattedChatText({ text, isUser }: { text: string; isUser: boolean }) {
  const lines = text.split('\n');
  const blocks: React.ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = (keyPrefix: string) => {
    if (listItems.length === 0) return;
    blocks.push(
      <ul key={`${keyPrefix}-list`} className="list-disc pl-4 space-y-1">
        {listItems.map((item, i) => (
          <li key={i}>{renderInlineSegments(item, isUser)}</li>
        ))}
      </ul>
    );
    listItems = [];
  };

  lines.forEach((rawLine, index) => {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      flushList(`empty-${index}`);
      return;
    }

    const bulletMatch = trimmed.match(/^(?:[-*]|\d+\.)\s+(.+)$/);
    if (bulletMatch) {
      listItems.push(bulletMatch[1]);
      return;
    }

    flushList(`line-${index}`);

    const headingMatch = trimmed.match(/^#{1,3}\s+(.+)$/);
    if (headingMatch) {
      blocks.push(
        <p key={`h-${index}`} className={`font-semibold ${isUser ? 'text-white' : 'text-[#0F2942]'}`}>
          {renderInlineSegments(headingMatch[1], isUser)}
        </p>
      );
      return;
    }

    blocks.push(
      <p key={`p-${index}`}>{renderInlineSegments(trimmed, isUser)}</p>
    );
  });

  flushList('end');

  return <div className="space-y-1.5 break-words">{blocks}</div>;
}

function createWelcomeMessage(roleId: ChatbotRoleId): ChatbotMessage {
  const cfg = CHATBOT_ROLES[roleId];
  return {
    id: `welcome-${roleId}-${Date.now()}`,
    role: 'assistant',
    chatbotRole: roleId,
    modelUsed: cfg.model,
    text:
      roleId === 'boq_planner'
        ? 'Tell me about your construction project (e.g., 2BHK house, 1,400 sq.ft, 2 floors, Chennai). We can refine electrical & plumbing quantities step-by-step across follow-up questions.'
        : roleId === 'platform_support'
          ? 'Ask me how to build material lists, export Indian GST PDF quotations, discover verified shops by PIN code, compare bids, or split orders across suppliers.'
          : roleId === 'quick_lookup'
            ? 'Ask for fast pipe size conversions, wire gauge basics, HSN/GST slabs, or quick catalogue specs.'
            : 'Ask me about copper wire sizing, MCB vs RCCB ratings, CPVC vs UPVC/SWR pipes, earthing, pumps, or compatible BuildMate catalogue items.',
    disclaimer:
      'AI guidance is informational only. Verify specifications and quantities with qualified electricians, plumbers, or MEP engineers before ordering.',
  };
}

export function AiAssistantDrawer() {
  const { aiDrawerOpen, setAiDrawerOpen, draftList, language } = useApp();
  const [chatbotRole, setChatbotRole] = useState<ChatbotRoleId>('material_advisor');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatbotMessage[]>([
    createWelcomeMessage('material_advisor'),
  ]);

  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const activeRoleConfig = CHATBOT_ROLES[chatbotRole];

  const draftListSummary = useMemo(() => {
    if (draftList.length === 0) return '';
    return draftList
      .slice(0, 15)
      .map(
        (i) =>
          `- ${i.productName} (${i.categoryName}, ${i.brand}): ${i.quantity} ${i.unit}, Est ₹${i.estimatedUnitPrice}`
      )
      .join('\n');
  }, [draftList]);

  useEffect(() => {
    if (aiDrawerOpen) {
      threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, aiDrawerOpen, loading]);

  const handleRoleChange = (nextRole: ChatbotRoleId) => {
    setChatbotRole(nextRole);
    const hasUserTurns = messages.some((m) => m.role === 'user');
    if (!hasUserTurns) {
      setMessages([createWelcomeMessage(nextRole)]);
    }
  };

  const handleResetChat = () => {
    if (loading) return;
    setMessages([createWelcomeMessage(chatbotRole)]);
    setInput('');
  };

  const sendMessageText = async (rawText: string) => {
    const question = rawText.trim();
    if (!question || loading) return;

    const historySnapshot = messages.map((m) => ({
      role: m.role,
      text: m.text,
      isError: m.isError,
    }));

    const userMsg: ChatbotMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: question,
      chatbotRole,
    };

    const assistantMsgId = `assistant-${Date.now() + 1}`;
    const placeholderAssistant: ChatbotMessage = {
      id: assistantMsgId,
      role: 'assistant',
      text: '',
      chatbotRole,
      modelUsed: activeRoleConfig.model,
    };

    setMessages((prev) => [...prev, userMsg, placeholderAssistant]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: question,
          history: historySnapshot,
          chatbotRole,
          language,
          draftListSummary,
        }),
      });

      const contentType = res.headers.get('content-type') || '';

      if (!res.ok || !contentType.includes('text/event-stream') || !res.body) {
        const data = await res.json().catch(() => ({}));
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  text: data.error || 'AI service could not complete the request.',
                  isError: true,
                }
              : m
          )
        );
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const evt of events) {
          const line = evt.trim();
          if (!line.startsWith('data:')) continue;
          const payloadStr = line.slice(5).trim();
          if (!payloadStr) continue;

          try {
            const payload = JSON.parse(payloadStr);
            if (payload.type === 'chunk' && payload.text) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId ? { ...m, text: m.text + payload.text } : m
                )
              );
            } else if (payload.type === 'done') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
                        text: m.text || payload.answer || 'No response generated.',
                        modelUsed: payload.modelUsed || activeRoleConfig.model,
                        disclaimer: payload.disclaimer,
                      }
                    : m
                )
              );
            } else if (payload.type === 'error') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
                        text: payload.error || 'AI chat failed.',
                        isError: true,
                      }
                    : m
                )
              );
            }
          } catch {
            // ignore malformed partial SSE line
          }
        }
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                text: 'Network error while reaching BuildMate AI assistant.',
                isError: true,
              }
            : m
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessageText(input);
  };

  if (!aiDrawerOpen) {
    return (
      <button
        type="button"
        onClick={() => setAiDrawerOpen(true)}
        aria-label="Open BuildMate AI Chatbot"
        className="fixed bottom-5 right-5 z-40 px-4 py-2.5 bg-[#0F2942] hover:bg-[#163A5C] text-white text-xs font-semibold rounded-md shadow-lg border border-slate-700 inline-flex items-center gap-2 no-print cursor-pointer"
      >
        <MessageSquare className="w-4 h-4 text-[#EA580C]" />
        <span>AI Material Chat</span>
      </button>
    );
  }

  const userTurnCount = messages.filter((m) => m.role === 'user').length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="BuildMate Multi-Turn Gemini AI Chatbot"
      className="fixed inset-0 z-50 bg-black/40 flex justify-end no-print"
    >
      <div className="bg-white w-full max-w-md h-full flex flex-col border-l border-slate-200 shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-[#0F2942] text-white">
          <div className="flex items-center gap-2.5 min-w-0">
            <Sparkles className="w-4 h-4 text-[#EA580C] shrink-0" />
            <div className="min-w-0">
              <h2 className="font-display text-sm font-bold truncate">BuildMate AI Chat</h2>
              <p className="text-[11px] text-slate-300 truncate">
                {activeRoleConfig.label} · {activeRoleConfig.model}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleResetChat}
              disabled={loading}
              title="Start new conversation"
              aria-label="Clear conversation history"
              className="px-2 py-1 text-[11px] font-medium text-slate-200 hover:text-white border border-slate-600 rounded inline-flex items-center gap-1 disabled:opacity-50 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>New Chat</span>
            </button>
            <button
              type="button"
              aria-label="Close AI Assistant"
              onClick={() => setAiDrawerOpen(false)}
              className="p-1 text-slate-300 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Role Selector */}
        <div className="p-2.5 border-b border-slate-200 bg-slate-50 space-y-2">
          <div className="grid grid-cols-2 gap-1.5" role="tablist" aria-label="Chatbot Assistant Roles">
            {(Object.keys(CHATBOT_ROLES) as ChatbotRoleId[]).map((roleKey) => {
              const cfg = CHATBOT_ROLES[roleKey];
              const active = chatbotRole === roleKey;
              return (
                <button
                  key={roleKey}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => handleRoleChange(roleKey)}
                  className={`px-2.5 py-1.5 text-left text-xs font-semibold rounded border transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#0F2942] text-white border-[#0F2942]'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {cfg.shortLabel}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-slate-600 leading-snug px-0.5">
            {activeRoleConfig.description}
          </p>
          <div className="flex items-center justify-between text-[11px] text-slate-500 px-0.5 pt-1 border-t border-slate-200">
            <span>
              Context: {draftList.length} list item(s) · {language === 'ta' ? 'தமிழ்' : 'English'}
            </span>
            <span className="font-mono-num">{userTurnCount} turn(s)</span>
          </div>
        </div>

        {/* Scrollable Multi-Turn Conversation Thread */}
        <div
          aria-live="polite"
          aria-label="Conversation history"
          className="flex-1 overflow-y-auto p-4 space-y-3 bg-white"
        >
          {messages.map((m) => (
            <div
              key={m.id}
              className={`p-3 rounded-lg text-xs leading-relaxed ${
                m.role === 'user'
                  ? 'bg-[#0F2942] text-white ml-8'
                  : m.isError
                    ? 'bg-red-50 border border-red-200 text-red-900 mr-6'
                    : 'bg-[#F4F6F8] border border-slate-200 text-slate-800 mr-6'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1 text-[10px] font-semibold uppercase tracking-wide opacity-75">
                <span>
                  {m.role === 'user'
                    ? 'You'
                    : m.chatbotRole
                      ? CHATBOT_ROLES[m.chatbotRole].shortLabel
                      : 'BuildMate AI'}
                </span>
                {m.role === 'assistant' && m.modelUsed && !m.isError && (
                  <span className="font-mono-num lowercase">{m.modelUsed}</span>
                )}
              </div>
              {m.text ? (
                <FormattedChatText text={m.text} isUser={m.role === 'user'} />
              ) : (
                <p className="text-slate-500">{loading && m.role === 'assistant' ? 'Thinking...' : ''}</p>
              )}
              {m.disclaimer && !m.isError && m.text && (
                <p className="mt-2 pt-2 border-t border-slate-200 text-[11px] text-amber-800 font-medium">
                  {m.disclaimer}
                </p>
              )}
            </div>
          ))}

          {/* Starter Prompts when conversation hasn't started yet */}
          {userTurnCount === 0 && !loading && (
            <div className="pt-2 space-y-1.5">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                Suggested Questions
              </p>
              {activeRoleConfig.starterPrompts.map((promptText) => (
                <button
                  key={promptText}
                  type="button"
                  onClick={() => sendMessageText(promptText)}
                  className="w-full text-left px-3 py-2 text-xs text-[#0F2942] bg-white hover:bg-slate-50 border border-slate-200 hover:border-[#EA580C] rounded-md transition-colors cursor-pointer"
                >
                  {promptText}
                </button>
              ))}
            </div>
          )}

          <div ref={threadEndRef} />
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="p-3 border-t border-slate-200 bg-slate-50 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a follow-up question..."
            aria-label="Message BuildMate AI chatbot"
            className="flex-1 px-3 py-2 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F2942]"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            aria-label="Send message to AI assistant"
            className="px-3.5 py-2 bg-[#EA580C] hover:bg-[#C2410C] text-white rounded-md disabled:opacity-50 inline-flex items-center gap-1 text-xs font-semibold cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
