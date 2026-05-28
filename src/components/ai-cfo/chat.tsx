"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { AI_PREFILL_STORAGE_KEY } from "@/lib/questionnaire/cfo-questions";

const SUGGESTED_QUESTIONS = [
  "Pourquoi ma marge baisse ?",
  "Puis-je augmenter mon budget Meta ?",
  "Puis-je embaucher ?",
  "Quels sont mes plus gros risques ?",
  "Quels produits détruisent ma rentabilité ?",
];

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function AICFOChat() {
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const autoStarted = useRef(false);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;

    const userMessage: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply ?? data.error ?? "Erreur de réponse." },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Impossible de contacter le CFO. Réessayez." },
      ]);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (autoStarted.current) return;
    if (searchParams.get("autostart") !== "1") return;

    const prefill = sessionStorage.getItem(AI_PREFILL_STORAGE_KEY);
    if (!prefill) return;

    autoStarted.current = true;
    sessionStorage.removeItem(AI_PREFILL_STORAGE_KEY);
    // Intentional one-time auto-send driven by the `autostart` URL param + sessionStorage.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    sendMessage(prefill);
  }, [searchParams, sendMessage]);

  return (
    <div className="flex flex-col h-[calc(100vh-220px)] rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && !loading && (
          <div className="text-center py-8">
            <p className="text-sm text-muted mb-6">
              Je suis votre CFO virtuel. Mes réponses s&apos;appuient sur vos données
              Shopify et les calculs du moteur financier — jamais d&apos;invention.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-stone-50 transition-colors text-muted hover:text-foreground"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "max-w-[85%] text-sm leading-relaxed",
              msg.role === "user"
                ? "ml-auto bg-accent text-white px-4 py-3 rounded-2xl rounded-br-sm"
                : "bg-stone-50 text-foreground px-4 py-3 rounded-2xl rounded-bl-sm border border-border"
            )}
          >
            <p className="whitespace-pre-wrap">{msg.content}</p>
          </div>
        ))}

        {loading && (
          <div className="text-sm text-muted animate-pulse">Analyse en cours...</div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border p-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
          placeholder="Posez votre question financière..."
          className="flex-1 px-3 py-2 text-sm bg-stone-50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/30"
          disabled={loading}
        />
        <Button onClick={() => sendMessage(input)} disabled={loading || !input.trim()}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
