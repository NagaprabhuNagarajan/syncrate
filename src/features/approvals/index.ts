// Approvals feature — public surface.

export { ApprovalsView } from "@/features/approvals/components/approvals-view";
export { RuleForm } from "@/features/approvals/components/rule-form";
export type { RoleOption } from "@/features/approvals/components/rule-form";

export { ApprovalService } from "@/features/approvals/services/approval.service";
export { evaluateCondition } from "@/features/approvals/utils/evaluate-condition";

export {
  createRuleAction,
  updateRuleAction,
  deleteRuleAction,
  approveRequestAction,
  rejectRequestAction,
  cancelRequestAction,
} from "@/features/approvals/actions/approval.actions";

export {
  conditionSchema,
  conditionFromFormSchema,
  createRuleSchema,
  updateRuleSchema,
  decisionSchema,
} from "@/features/approvals/schemas/approval.schemas";

export type {
  ApprovalCondition,
  ApprovalOperator,
  ApprovalRule,
  ApprovalRequest,
  ApprovalRequestStatus,
  ApprovalResult,
  CreateRuleInput,
  UpdateRuleInput,
  EvaluateAndRaiseInput,
} from "@/features/approvals/types/approval.types";
