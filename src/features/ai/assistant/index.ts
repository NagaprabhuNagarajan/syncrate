/** AI Business Assistant (spec §6) — public surface. */

export { AssistantView } from "@/features/ai/assistant/components/assistant-view";
export { MessageBubble } from "@/features/ai/assistant/components/message-bubble";
export { ProposedActionCard } from "@/features/ai/assistant/components/proposed-action-card";
export { AssistantService } from "@/features/ai/assistant/services/assistant.service";
export type { AssistantServiceDeps } from "@/features/ai/assistant/services/assistant.service";
export {
  sendAssistantMessageAction,
  approveProposedActionAction,
} from "@/features/ai/assistant/actions/assistant.actions";
export { useAssistant } from "@/features/ai/assistant/hooks/useAssistant";
export type { DisplayMessage } from "@/features/ai/assistant/hooks/useAssistant";
export type {
  AssistantMessage,
  AssistantTurn,
  AssistantResult,
  ApprovedAction,
  ApprovedActionKind,
} from "@/features/ai/assistant/types/assistant.types";
