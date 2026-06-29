"use client";

import { useCallback } from "react";
import { Bot, User } from "lucide-react";
import { cn } from "@/utils/cn";
import { ProposedActionCard } from "@/features/ai/assistant/components/proposed-action-card";
import type { DisplayMessage } from "@/features/ai/assistant/hooks/useAssistant";

interface MessageBubbleProps {
  readonly message: DisplayMessage;
  readonly onApprove: (messageId: string) => void;
  readonly isApproving: boolean;
}

/** A single chat row: avatar + content, plus any proposed-action review card. */
export function MessageBubble({
  message,
  onApprove,
  isApproving,
}: MessageBubbleProps) {
  const isUser = message.role === "user";

  const handleApprove = useCallback(() => {
    onApprove(message.id);
  }, [onApprove, message.id]);

  return (
    <div
      className={cn(
        "flex gap-3",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-primary-600 text-white" : "border bg-muted text-slate-600 dark:text-slate-400"
        )}
        aria-hidden="true"
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      <div className={cn("min-w-0 max-w-[85%]", isUser && "items-end")}>
        <div
          className={cn(
            "whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm",
            isUser
              ? "bg-primary-600 text-white"
              : "border border-slate-200 bg-white text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
          )}
        >
          {message.content}
        </div>

        {message.proposedAction && (
          <ProposedActionCard
            action={message.proposedAction}
            onApprove={handleApprove}
            isApproving={isApproving}
            approved={message.approved}
          />
        )}
      </div>
    </div>
  );
}

MessageBubble.displayName = "MessageBubble";
