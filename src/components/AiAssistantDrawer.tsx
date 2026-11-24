import React, { useState } from 'react';
import { Sparkles, X, Send } from 'lucide-react';
import { useApp } from '../context/AppContext';

export function AiAssistantDrawer() {
  const { aiDrawerOpen, setAiDrawerOpen } = useApp();
  const [mode, setMode] = useState<'assistant' | 'support'>('assistant');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<
    Array<{ role: 'user' | 'assistant'; text: string; disclaimer?: string }>
  >([
    {
      role: 'assistant',
      text: 'Ask me about electrical wire gauges, MCB vs RCCB selection, CPVC vs UPVC pipe ratings, or how to request multi-shop quotations on BuildMate.',
      disclaimer:
        'AI guidance is informational only. Verify specifications with qualified electricians, plumbers, or MEP engineers.',
    },
  ]);

  if (!aiDrawerOpen) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const question = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: question }]);
    setLoading(true);

    try {
      const res = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, mode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', text: data.error || 'AI service could not complete the request.' },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', text: data.answer, disclaimer: data.disclaimer },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: 'Network error while reaching AI assistant.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="BuildMate AI Material & Support Assistant"
      className="fixed inset-0 z-50 bg-black/40 flex justify-end no-print"
    >
      <div className="bg-white w-full max-w-md h-full flex flex-col border-l border-slate-200">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-[#0F2942] text-white">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#EA580C]" />
            <h2 className="font-display text-sm font-bold">BuildMate AI Assistant</h2>
          </div>
          <button
            type="button"
            aria-label="Close AI Assistant"
            onClick={() => setAiDrawerOpen(false)}
            className="p-1 text-slate-300 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-2 border-b border-slate-200 bg-slate-50 flex gap-1">
          <button
            type="button"
            onClick={() => setMode('assistant')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded cursor-pointer ${
              mode === 'assistant' ? 'bg-white text-[#0F2942] shadow-xs' : 'text-slate-600'
            }`}
          >
            Material Specs Assistant
          </button>
          <button
            type="button"
            onClick={() => setMode('support')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded cursor-pointer ${
              mode === 'support' ? 'bg-white text-[#0F2942] shadow-xs' : 'text-slate-600'
            }`}
          >
            Platform Support
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-lg text-xs leading-relaxed ${
                m.role === 'user'
                  ? 'bg-[#0F2942] text-white ml-8'
                  : 'bg-[#F4F6F8] border border-slate-200 text-slate-800 mr-6'
              }`}
            >
              <p className="whitespace-pre-line">{m.text}</p>
              {m.disclaimer && (
                <p className="mt-2 pt-2 border-t border-slate-200 text-[11px] text-amber-800 font-medium">
                  {m.disclaimer}
                </p>
              )}
            </div>
          ))}
          {loading && <p className="text-xs text-slate-500">Thinking...</p>}
        </div>

        <form onSubmit={handleSend} className="p-3 border-t border-slate-200 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about wire sizes, CPVC specs, or quoting..."
            className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-md"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            aria-label="Send message to AI assistant"
            className="px-3.5 py-2 bg-[#EA580C] text-white rounded-md disabled:opacity-50 cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
