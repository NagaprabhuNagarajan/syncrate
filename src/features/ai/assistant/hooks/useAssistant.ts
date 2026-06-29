"use client";

import { useCallback, useRef, useState } from "react";
import {
  approveProposedActionAction,
  sendAssistantMessageAction,
} from "@/features/ai/assistant/actions/assistant.actions";
import type { AiProposedAction } from "@/features/ai/services/ai-gateway.service";
import type {
  AssistantMessage,
  ApprovedAction,
} from "@/features/ai/assistant/types/assistant.types";

/** A chat message enriched for display (the wire format is role + content). */
export interface DisplayMessage {
  readonly id: string;
  readonly role: "user" | "assistant";
  readonly content: string;
  /** A mutating action this turn proposed, pending the user's approval. */
  readonly proposedAction?: AiProposedAction | null;
  /** Read-only tools the assistant used this turn (transparency). */
  readonly toolCalls?: ReadonlyArray<{ name: string; input: unknown }>;
  /** Set once the proposed action on this message has been approved. */
  readonly approved?: ApprovedAction;
}

let counter = 0;
function nextId(): string {
  counter += 1;
  return `m${counter}-${Date.now()}`;
}

export interface UseAssistantResult {
  readonly messages: ReadonlyArray<DisplayMessage>;
  readonly send: (text: string) => Promise<void>;
  readonly approve: (messageId: string) => Promise<void>;
  readonly isSending: boolean;
  readonly approvingId: string | null;
  readonly error: string | null;
}

/**
 * Client state machine for the assistant chat. Sends the full history to the
 * server each turn, records any proposed action on the assistant message, and
 * exposes an `approve` callback that creates the real document on user click.
 */
export function useAssistant(organizationId: string): UseAssistantResult {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Mirror of the wire history (role + content) for replay to the model.
  const historyRef = useRef<AssistantMessage[]>([]);

  const send = useCallback(
    async (text: string): Promise<void> => {
      const trimmed = text.trim();
      if (trimmed === "" || isSending) {
        return;
      }
      setError(null);

      const userMessage: DisplayMessage = {
        id: nextId(),
        role: "user",
        content: trimmed,
      };
      const wireHistory: AssistantMessage[] = [
        ...historyRef.current,
        { role: "user", content: trimmed },
      ];
      historyRef.current = wireHistory;
      setMessages((prev) => [...prev, userMessage]);
      setIsSending(true);

      const response = await sendAssistantMessageAction(
        organizationId,
        wireHistory
      );

      if (!response.success) {
        setError(response.error.message);
        setIsSending(false);
        return;
      }

      const { text: reply, proposedAction, toolCalls } = response.data;
      const assistantContent =
        reply ||
        (proposedAction
          ? "I've prepared a draft for your review below."
          : "I don't have a response for that.");

      historyRef.current = [
        ...historyRef.current,
        { role: "assistant", content: assistantContent },
      ];
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: "assistant",
          content: assistantContent,
          proposedAction,
          toolCalls,
        },
      ]);
      setIsSending(false);
    },
    [organizationId, isSending]
  );

  const approve = useCallback(
    async (messageId: string): Promise<void> => {
      const target = messages.find((m) => m.id === messageId);
      if (!target?.proposedAction || approvingId) {
        return;
      }
      setError(null);
      setApprovingId(messageId);

      const response = await approveProposedActionAction(
        organizationId,
        target.proposedAction
      );

      if (!response.success) {
        setError(response.error.message);
        setApprovingId(null);
        return;
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, approved: response.data } : m
        )
      );
      setApprovingId(null);
    },
    [messages, organizationId, approvingId]
  );

  return { messages, send, approve, isSending, approvingId, error };
}
