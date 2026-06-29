// Workflows feature — public surface.
//
// NOTE: `WorkflowEngineService` is intentionally NOT re-exported here. It is
// `server-only` (it drives webhook delivery + the approval engine) and is
// imported directly by the server actions via its full path so this barrel
// stays safe to pull into any server module.

export { WorkflowsView } from "@/features/workflows/components/workflows-view";
export { WorkflowForm } from "@/features/workflows/components/workflow-form";

export { WorkflowService } from "@/features/workflows/services/workflow.service";

export {
  createWorkflowAction,
  updateWorkflowAction,
  deleteWorkflowAction,
  runWorkflowAction,
  resumeWorkflowInstanceAction,
} from "@/features/workflows/actions/workflow.actions";

export {
  stepSchema,
  stepsSchema,
  definitionSchema,
  createWorkflowSchema,
  updateWorkflowSchema,
  parseStepsJson,
} from "@/features/workflows/schemas/workflow.schemas";

export type {
  Workflow,
  WorkflowStep,
  WorkflowStepType,
  WorkflowDefinition,
  WorkflowInstance,
  WorkflowInstanceStatus,
  WorkflowStepExecution,
  WorkflowStepExecutionStatus,
  WorkflowRun,
  CreateWorkflowInput,
  UpdateWorkflowInput,
  StartWorkflowInput,
  ResumeInstanceInput,
  WorkflowResult,
} from "@/features/workflows/types/workflow.types";
