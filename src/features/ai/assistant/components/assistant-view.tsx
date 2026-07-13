"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { ErrorBanner } from "@/components/shared/error-banner";
import { MessageBubble } from "@/features/ai/assistant/components/message-bubble";
import { useAssistant } from "@/features/ai/assistant/hooks/useAssistant";

const SUGGESTIONS: readonly string[] = [
  "Which products are low on stock?",
  "Show me my top customers",
  "Create an invoice for 10 Cement Bags for ABC Hardware",
];

interface SuggestionChipProps {
  readonly text: string;
  readonly onSelect: (text: string) => void;
  readonly disabled: boolean;
}

function SuggestionChip({ text, onSelect, disabled }: SuggestionChipProps) {
  const handleClick = useCallback(() => {
    onSelect(text);
  }, [onSelect, text]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className="hover:border-primary-400 hover:text-primary-700 dark:hover:text-primary-300 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-left text-sm text-slate-600 shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
    >
      {text}
    </button>
  );
}

SuggestionChip.displayName = "SuggestionChip";

interface AssistantViewProps {
  readonly organizationId: string;
}

/** The conversational AI Business Assistant surface (spec §6). */
export function AssistantView({ organizationId }: AssistantViewProps) {
  const { messages, send, approve, isSending, approvingId, error } =
    useAssistant(organizationId);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isSending]);

  const submit = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (trimmed === "" || isSending) {
        return;
      }
      setInput("");
      await send(trimmed);
    },
    [isSending, send]
  );

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void submit(input);
    },
    [input, submit]
  );

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(event.target.value);
    },
    []
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void submit(input);
      }
    },
    [input, submit]
  );

  const handleSuggestion = useCallback(
    (text: string) => {
      void submit(text);
    },
    [submit]
  );

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col p-4 lg:p-6">
      <PageHeader
        title="AI Assistant"
        description="Ask about your business or prepare invoices — you approve every action."
        icon={Sparkles}
      />

      <div
        ref={scrollRef}
        className="mt-4 flex-1 space-y-4 overflow-y-auto pr-1"
        aria-live="polite"
      >
        {isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="bg-gradient-brand shadow-glow-primary flex h-12 w-12 items-center justify-center rounded-full text-white">
              <Sparkles className="h-6 w-6" aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
              How can I help?
            </h2>
            <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
              I can look up customers, suppliers, products and stock, and prepare
              invoices for you to review.
            </p>
            <div className="mt-6 flex max-w-xl flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <SuggestionChip
                  key={suggestion}
                  text={suggestion}
                  onSelect={handleSuggestion}
                  disabled={isSending}
                />
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              onApprove={approve}
              isApproving={approvingId === message.id}
            />
          ))
        )}

        {isSending && (
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <LoadingSpinner size="sm" label="Assistant is thinking" />
            Thinking…
          </div>
        )}
      </div>

      {error && <ErrorBanner message={error} className="mt-4" />}

      <form
        onSubmit={handleSubmit}
        className="mt-4 flex items-end gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <label htmlFor="assistant-input" className="sr-only">
          Message the assistant
        </label>
        <textarea
          id="assistant-input"
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Ask a question or describe an invoice to prepare…"
          disabled={isSending}
          className="max-h-32 flex-1 resize-none border-0 bg-transparent px-2 py-1.5 text-sm text-slate-900 placeholder-slate-400 dark:text-slate-100 dark:placeholder-slate-500 focus:outline-none focus:ring-0 disabled:opacity-50"
        />
        <Button
          type="submit"
          variant="gradient"
          size="sm"
          loading={isSending}
          disabled={input.trim() === ""}
          aria-label="Send message"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
        </Button>
      </form>
    </div>
  );
}

AssistantView.displayName = "AssistantView";
