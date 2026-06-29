"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles, Send, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { MessageBubble } from "@/features/ai/assistant/components/message-bubble";
import { useAssistant } from "@/features/ai/assistant/hooks/useAssistant";

const SUGGESTIONS: readonly string[] = [
  "Which products are low on stock?",
  "Show me my top customers",
  "Create an invoice for 10 Cement Bags for ABC Hardware",
  "Prepare a quotation for 5 units of Steel Rods",
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
      className="hover:border-primary-400 hover:text-primary-700 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-left text-sm text-slate-600 shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
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
    <div className="flex h-[calc(100vh-4rem)] flex-col p-6 lg:p-8">
      <PageHeader
        title="AI Assistant"
        description="Ask about your business or prepare invoices and quotations — you approve every action."
        icon={Sparkles}
      />

      <div
        ref={scrollRef}
        className="mt-6 flex-1 space-y-5 overflow-y-auto pr-1"
        aria-live="polite"
      >
        {isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="bg-primary-50 text-primary-600 flex h-12 w-12 items-center justify-center rounded-full">
              <Sparkles className="h-6 w-6" aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-slate-900">
              How can I help?
            </h2>
            <p className="mt-1 max-w-md text-sm text-slate-500">
              I can look up customers, suppliers, products and stock, and prepare
              invoices or quotations for you to review.
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
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <LoadingSpinner size="sm" label="Assistant is thinking" />
            Thinking…
          </div>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="text-error-700 bg-error-50 border-error-200 mt-4 flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        className="mt-4 flex items-end gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm"
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
          className="max-h-32 flex-1 resize-none border-0 bg-transparent px-2 py-1.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-0 disabled:opacity-50"
        />
        <Button
          type="submit"
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
