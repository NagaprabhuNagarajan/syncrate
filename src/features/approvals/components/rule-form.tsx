"use client";

import { useState, useTransition } from "react";
import {
  createRuleAction,
  updateRuleAction,
} from "@/features/approvals/actions/approval.actions";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/shared/error-banner";
import type {
  ApprovalOperator,
  ApprovalRule,
} from "@/features/approvals/types/approval.types";

export interface RoleOption {
  readonly id: string;
  readonly name: string;
}

// Only entities whose creation flow actually evaluates approval rules today.
const ENTITY_TYPE_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "purchase_invoice", label: "Bill" },
  { value: "sales_invoice", label: "Invoice" },
];

// Fields available to compare against. Values match the keys the creation
// flows pass to the approval evaluator, so a rule never silently fails to fire.
const CONDITION_FIELD_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "total_amount", label: "Total amount" },
];

const OPERATOR_OPTIONS: readonly { value: ApprovalOperator; label: string }[] =
  [
    { value: "gte", label: "≥ (greater than or equal)" },
    { value: "gt", label: "> (greater than)" },
    { value: "lte", label: "≤ (less than or equal)" },
    { value: "lt", label: "< (less than)" },
    { value: "eq", label: "= (equals)" },
  ];

const INPUT_CLASS =
  "block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-muted-foreground shadow-sm transition-[border-color,box-shadow] duration-150 ease-out hover:border-slate-400 dark:hover:border-slate-600 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40";

const LABEL_CLASS = "mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300";

interface RuleFormProps {
  readonly organizationId: string;
  readonly roles: readonly RoleOption[];
  readonly rule?: ApprovalRule;
  readonly onClose: () => void;
  readonly onSaved: () => void;
}

export function RuleForm({
  organizationId,
  roles,
  rule,
  onClose,
  onSaved,
}: RuleFormProps) {
  const isEdit = Boolean(rule);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    startSaving(async () => {
      const response = rule
        ? await updateRuleAction(organizationId, rule.id, formData)
        : await createRuleAction(organizationId, formData);
      if (!response.success) {
        setError(response.error.message);
        return;
      }
      onSaved();
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      aria-label={isEdit ? "Edit approval rule" : "Create approval rule"}
      className="mt-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm"
    >
      {rule && (
        <input type="hidden" name="version" value={String(rule.version)} />
      )}

      {error && <ErrorBanner message={error} className="mb-4" />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="rule-name" className={LABEL_CLASS}>
            Rule name
          </label>
          <input
            id="rule-name"
            name="name"
            type="text"
            required
            defaultValue={rule?.name ?? ""}
            placeholder="e.g. High-value purchase invoices"
            className={INPUT_CLASS}
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="rule-description" className={LABEL_CLASS}>
            Description
          </label>
          <input
            id="rule-description"
            name="description"
            type="text"
            defaultValue={rule?.description ?? ""}
            placeholder="Optional — what this rule is for"
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label htmlFor="rule-entity-type" className={LABEL_CLASS}>
            Entity type
          </label>
          <select
            id="rule-entity-type"
            name="entityType"
            defaultValue={rule?.entityType ?? ENTITY_TYPE_OPTIONS[0]?.value}
            className={INPUT_CLASS}
          >
            {ENTITY_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="rule-approver-role" className={LABEL_CLASS}>
            Approver role
          </label>
          <select
            id="rule-approver-role"
            name="approverRoleId"
            defaultValue={rule?.approverRoleId ?? ""}
            className={INPUT_CLASS}
          >
            <option value="">Any authorized approver</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            Only roles with the “Approve or reject” permission are listed.
          </p>
        </div>
      </div>

      <fieldset className="mt-4 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
        <legend className="px-1 text-sm font-medium text-slate-700 dark:text-slate-300">
          Condition
        </legend>
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          When a matching document is created and this comparison is true, a
          pending approval is raised automatically.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="rule-condition-field" className={LABEL_CLASS}>
              Field
            </label>
            <select
              id="rule-condition-field"
              name="conditionField"
              defaultValue={
                rule?.condition.field ?? CONDITION_FIELD_OPTIONS[0]?.value
              }
              className={INPUT_CLASS}
            >
              {CONDITION_FIELD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="rule-condition-operator" className={LABEL_CLASS}>
              Operator
            </label>
            <select
              id="rule-condition-operator"
              name="conditionOperator"
              defaultValue={rule?.condition.operator ?? "gte"}
              className={INPUT_CLASS}
            >
              {OPERATOR_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="rule-condition-value" className={LABEL_CLASS}>
              Value
            </label>
            <input
              id="rule-condition-value"
              name="conditionValue"
              type="text"
              required
              defaultValue={
                rule ? String(rule.condition.value) : "100000"
              }
              placeholder="e.g. 100000"
              className={INPUT_CLASS}
            />
          </div>
        </div>
      </fieldset>

      <div className="mt-4 flex items-center gap-2">
        <input
          id="rule-active"
          name="isActive"
          type="checkbox"
          value="true"
          defaultChecked={rule?.isActive ?? true}
          className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 text-primary-600 focus:ring-primary-500"
        />
        <label htmlFor="rule-active" className="text-sm text-slate-700 dark:text-slate-300">
          Active
        </label>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="gradient" loading={isSaving}>
          {isEdit ? "Save changes" : "Create rule"}
        </Button>
      </div>
    </form>
  );
}
