"use client";

import { motion } from "framer-motion";
import { FileText, Check, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { proposedDocumentSchema } from "@/features/ai/assistant/schemas/assistant.schemas";
import type { AiProposedAction } from "@/features/ai/services/ai-gateway.service";
import type { ApprovedAction } from "@/features/ai/assistant/types/assistant.types";

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

const DOC_LABEL: Record<string, string> = {
  propose_invoice: "Draft invoice",
};

interface ProposedActionCardProps {
  readonly action: AiProposedAction;
  readonly onApprove: () => void;
  readonly isApproving: boolean;
  readonly approved?: ApprovedAction;
}

/**
 * Renders a proposed (NOT yet created) invoice as a review card with
 * an explicit "Approve & Create" affordance — the human-in-the-loop gate that
 * satisfies the assistant's "user approval for AI actions" acceptance criterion.
 */
export function ProposedActionCard({
  action,
  onApprove,
  isApproving,
  approved,
}: ProposedActionCardProps) {
  const parsed = proposedDocumentSchema.safeParse(action.input);
  const label = DOC_LABEL[action.tool] ?? "Draft document";

  if (!parsed.success) {
    return (
      <div className="border-warning/40 bg-warning/5 mt-3 rounded-xl border p-4 text-sm text-slate-700 dark:text-slate-300">
        The assistant proposed an action but it was missing required details.
        Please refine your request.
      </div>
    );
  }

  const doc = parsed.data;
  const total = doc.items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/40">
        <div className="flex items-center gap-2">
          <FileText
            className="text-primary-600 dark:text-primary-400 h-4 w-4"
            aria-hidden="true"
          />
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{label}</span>
          <Badge variant="outline">Needs your approval</Badge>
        </div>
        {doc.customerName && (
          <span className="text-xs text-slate-500 dark:text-slate-400">{doc.customerName}</span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">
                Item
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Qty
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Unit price
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                GST %
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Amount
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
            {doc.items.map((item) => (
              <tr key={`${item.productId}-${item.quantity}-${item.unitPrice}`}>
                <td className="px-3 py-2 text-slate-800 dark:text-slate-100">
                  {item.productName ?? item.productId}
                </td>
                <td className="nums px-3 py-2 text-right text-slate-700 dark:text-slate-300">
                  {item.quantity}
                </td>
                <td className="nums px-3 py-2 text-right text-slate-700 dark:text-slate-300">
                  {currencyFormatter.format(item.unitPrice)}
                </td>
                <td className="nums px-3 py-2 text-right text-slate-700 dark:text-slate-300">
                  {item.gstRate ?? "—"}
                </td>
                <td className="nums px-3 py-2 text-right text-slate-900 dark:text-slate-100">
                  {currencyFormatter.format(item.quantity * item.unitPrice)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-100 dark:border-slate-800">
              <td
                className="px-3 py-2 text-right text-xs font-medium uppercase text-slate-500 dark:text-slate-400"
                colSpan={4}
              >
                Subtotal (excl. tax)
              </td>
              <td className="nums px-3 py-2 text-right font-semibold text-slate-900 dark:text-slate-100">
                {currencyFormatter.format(total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-3 py-2 dark:border-slate-800">
        <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          Nothing is created until you approve.
        </p>
        {approved ? (
          <span className="text-success inline-flex items-center gap-1.5 text-sm font-medium">
            <Check className="h-4 w-4" aria-hidden="true" />
            Invoice created
          </span>
        ) : (
          <Button
            type="button"
            size="sm"
            onClick={onApprove}
            loading={isApproving}
          >
            <Check className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Approve &amp; Create
          </Button>
        )}
      </div>
    </motion.div>
  );
}

ProposedActionCard.displayName = "ProposedActionCard";
