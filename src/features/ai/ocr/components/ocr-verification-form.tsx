"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle2, FilePlus, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { OCR_DOCUMENT_TYPES } from "@/features/ai/ocr/schemas/ocrExtractionSchema";
import {
  buildOcrPurchaseDraft,
  saveOcrPurchaseDraft,
} from "@/features/ai/ocr/utils/purchase-draft";
import type {
  OcrDocumentType,
  OcrExtraction,
} from "@/features/ai/ocr/schemas/ocrExtractionSchema";

// ─────────────────────────────────────────────────────────────
// Presentation helpers
// ─────────────────────────────────────────────────────────────

const inputClass =
  "block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-slate-900 placeholder:text-muted-foreground shadow-sm transition-[border-color,box-shadow] duration-150 ease-out hover:border-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:text-slate-100 dark:hover:border-slate-600";

const labelClass = "mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400";

const DOCUMENT_TYPE_LABELS: Record<OcrDocumentType, string> = {
  purchase_bill: "Purchase bill",
  tax_invoice: "Tax invoice",
  receipt: "Receipt",
  delivery_challan: "Delivery challan",
  product_label: "Product label",
  other: "Other",
};

function confidenceVariant(value: number): BadgeProps["variant"] {
  if (value >= 0.85) {
    return "success";
  }
  if (value >= 0.6) {
    return "warning";
  }
  return "destructive";
}

function confidenceLabel(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function ConfidenceBadge({ value }: { readonly value: number | null }) {
  if (value === null) {
    return null;
  }
  return (
    <Badge dot variant={confidenceVariant(value)}>
      {confidenceLabel(value)} confident
    </Badge>
  );
}

// ─────────────────────────────────────────────────────────────
// Local (editable) form state — strings keep inputs controllable
// ─────────────────────────────────────────────────────────────

interface LineItemForm {
  /** Stable client-side key for React list rendering (not persisted). */
  readonly _key: string;
  readonly description: string;
  readonly quantity: string;
  readonly unitPrice: string;
  readonly taxPercent: string;
  readonly lineTotal: string;
}

let lineItemKeySeq = 0;
function nextLineItemKey(): string {
  lineItemKeySeq += 1;
  return `li-${lineItemKeySeq}`;
}

interface ScalarForm {
  documentType: OcrDocumentType;
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string;
  gstNumber: string;
  currency: string;
  subtotal: string;
  taxTotal: string;
  grandTotal: string;
  overallNotes: string;
}

function numToStr(value: number | null): string {
  return value === null ? "" : String(value);
}

function strOrEmpty(value: string | null): string {
  return value ?? "";
}

function toScalarForm(e: OcrExtraction): ScalarForm {
  return {
    documentType: e.documentType,
    supplierName: strOrEmpty(e.supplierName),
    invoiceNumber: strOrEmpty(e.invoiceNumber),
    invoiceDate: strOrEmpty(e.invoiceDate),
    gstNumber: strOrEmpty(e.gstNumber),
    currency: e.currency,
    subtotal: numToStr(e.subtotal),
    taxTotal: numToStr(e.taxTotal),
    grandTotal: numToStr(e.grandTotal),
    overallNotes: e.overallNotes,
  };
}

function toLineItemForms(e: OcrExtraction): LineItemForm[] {
  return e.lineItems.map((item) => ({
    _key: nextLineItemKey(),
    description: item.description,
    quantity: numToStr(item.quantity),
    unitPrice: numToStr(item.unitPrice),
    taxPercent: numToStr(item.taxPercent),
    lineTotal: numToStr(item.lineTotal),
  }));
}

function makeEmptyItem(): LineItemForm {
  return {
    _key: nextLineItemKey(),
    description: "",
    quantity: "",
    unitPrice: "",
    taxPercent: "",
    lineTotal: "",
  };
}

// ─────────────────────────────────────────────────────────────
// Line item row (owns its index → no closures created in parent render)
// ─────────────────────────────────────────────────────────────

interface LineItemRowProps {
  readonly index: number;
  readonly row: LineItemForm;
  readonly onChange: (index: number, field: keyof LineItemForm, value: string) => void;
  readonly onRemove: (index: number) => void;
}

function LineItemRow({ index, row, onChange, onRemove }: LineItemRowProps) {
  const handleField = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>): void => {
      onChange(index, event.target.name as keyof LineItemForm, event.target.value);
    },
    [index, onChange]
  );

  const handleRemove = useCallback((): void => {
    onRemove(index);
  }, [index, onRemove]);

  return (
    <tr className="align-top">
      <td className="px-2 py-2">
        <input
          name="description"
          aria-label={`Line ${index + 1} description`}
          value={row.description}
          onChange={handleField}
          className={inputClass}
        />
      </td>
      <td className="px-2 py-2">
        <input
          name="quantity"
          inputMode="decimal"
          aria-label={`Line ${index + 1} quantity`}
          value={row.quantity}
          onChange={handleField}
          className={inputClass}
        />
      </td>
      <td className="px-2 py-2">
        <input
          name="unitPrice"
          inputMode="decimal"
          aria-label={`Line ${index + 1} unit price`}
          value={row.unitPrice}
          onChange={handleField}
          className={inputClass}
        />
      </td>
      <td className="px-2 py-2">
        <input
          name="taxPercent"
          inputMode="decimal"
          aria-label={`Line ${index + 1} tax percent`}
          value={row.taxPercent}
          onChange={handleField}
          className={inputClass}
        />
      </td>
      <td className="px-2 py-2">
        <input
          name="lineTotal"
          inputMode="decimal"
          aria-label={`Line ${index + 1} line total`}
          value={row.lineTotal}
          onChange={handleField}
          className={inputClass}
        />
      </td>
      <td className="px-2 py-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove line ${index + 1}`}
          onClick={handleRemove}
        >
          <Trash2 className="h-4 w-4 text-error" aria-hidden="true" />
        </Button>
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────
// Verification form
// ─────────────────────────────────────────────────────────────

interface OcrVerificationFormProps {
  readonly extraction: OcrExtraction;
  readonly model: string;
  readonly onReset: () => void;
  /** Owning organization — threaded into the purchase-bill hand-off URL. */
  readonly organizationId?: string;
}

export function OcrVerificationForm({
  extraction,
  model,
  onReset,
  organizationId,
}: OcrVerificationFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<ScalarForm>(() => toScalarForm(extraction));
  const [items, setItems] = useState<LineItemForm[]>(() =>
    toLineItemForms(extraction)
  );
  const [confirmed, setConfirmed] = useState(false);

  const fieldConfidence = extraction.fieldConfidence;

  const handleTextChange = useCallback(
    (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ): void => {
      const name = event.target.name as Exclude<keyof ScalarForm, "documentType">;
      const { value } = event.target;
      setForm((prev) => ({ ...prev, [name]: value }));
      setConfirmed(false);
    },
    []
  );

  const handleDocumentTypeChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>): void => {
      const documentType = event.target.value as OcrDocumentType;
      setForm((prev) => ({ ...prev, documentType }));
      setConfirmed(false);
    },
    []
  );

  const handleItemChange = useCallback(
    (index: number, field: keyof LineItemForm, value: string): void => {
      setItems((prev) =>
        prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
      );
      setConfirmed(false);
    },
    []
  );

  const handleItemRemove = useCallback((index: number): void => {
    setItems((prev) => prev.filter((_item, i) => i !== index));
    setConfirmed(false);
  }, []);

  const handleAddItem = useCallback((): void => {
    setItems((prev) => [...prev, makeEmptyItem()]);
    setConfirmed(false);
  }, []);

  const handleConfirm = useCallback((): void => {
    setConfirmed(true);
  }, []);

  const handleCreatePurchaseBill = useCallback((): void => {
    saveOcrPurchaseDraft(
      buildOcrPurchaseDraft({
        supplierName: form.supplierName,
        supplierInvoiceNumber: form.invoiceNumber,
        invoiceDate: form.invoiceDate,
        items: items.map((it) => ({
          description: it.description,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          taxPercent: it.taxPercent,
        })),
      })
    );
    const orgParam = organizationId
      ? `&org=${encodeURIComponent(organizationId)}`
      : "";
    router.push(`/bills/new?fromOcr=1${orgParam}`);
  }, [form, items, organizationId, router]);

  const overallPercent = useMemo(
    () => confidenceLabel(extraction.confidence),
    [extraction.confidence]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      {/* Summary / confidence banner */}
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Review extracted data</CardTitle>
            <CardDescription>
              Verify and correct the values below before saving. Nothing is saved
              automatically.
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge dot variant={confidenceVariant(extraction.confidence)}>
              {overallPercent} overall confidence
            </Badge>
            <span className="text-xs text-muted-foreground">{model}</span>
          </div>
        </CardHeader>
        {extraction.overallNotes.trim().length > 0 && (
          <CardContent>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
              {extraction.overallNotes}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Document details */}
      <Card>
        <CardHeader>
          <CardTitle>Document details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="documentType">
              Document type
            </label>
            <select
              id="documentType"
              name="documentType"
              value={form.documentType}
              onChange={handleDocumentTypeChange}
              className={inputClass}
            >
              {OCR_DOCUMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {DOCUMENT_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="supplierName">
              <span className="mr-2">Supplier name</span>
              <ConfidenceBadge value={fieldConfidence.supplierName} />
            </label>
            <input
              id="supplierName"
              name="supplierName"
              value={form.supplierName}
              onChange={handleTextChange}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="invoiceNumber">
              <span className="mr-2">Invoice / bill number</span>
              <ConfidenceBadge value={fieldConfidence.invoiceNumber} />
            </label>
            <input
              id="invoiceNumber"
              name="invoiceNumber"
              value={form.invoiceNumber}
              onChange={handleTextChange}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="invoiceDate">
              <span className="mr-2">Invoice date</span>
              <ConfidenceBadge value={fieldConfidence.invoiceDate} />
            </label>
            <input
              id="invoiceDate"
              name="invoiceDate"
              type="date"
              value={form.invoiceDate}
              onChange={handleTextChange}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="gstNumber">
              <span className="mr-2">GST number</span>
              <ConfidenceBadge value={fieldConfidence.gstNumber} />
            </label>
            <input
              id="gstNumber"
              name="gstNumber"
              value={form.gstNumber}
              onChange={handleTextChange}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="currency">
              Currency
            </label>
            <input
              id="currency"
              name="currency"
              value={form.currency}
              onChange={handleTextChange}
              className={inputClass}
            />
          </div>
        </CardContent>
      </Card>

      {/* Line items */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <CardTitle>Line items</CardTitle>
            <ConfidenceBadge value={fieldConfidence.lineItems} />
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Add line
          </Button>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No line items were detected. Add one if needed.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <tr>
                    <th scope="col" className="px-2 py-2 font-medium">
                      Description
                    </th>
                    <th scope="col" className="px-2 py-2 font-medium">
                      Qty
                    </th>
                    <th scope="col" className="px-2 py-2 font-medium">
                      Unit price
                    </th>
                    <th scope="col" className="px-2 py-2 font-medium">
                      Tax %
                    </th>
                    <th scope="col" className="px-2 py-2 font-medium">
                      Line total
                    </th>
                    <th scope="col" className="px-2 py-2">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row, index) => (
                    <LineItemRow
                      key={row._key}
                      index={index}
                      row={row}
                      onChange={handleItemChange}
                      onRemove={handleItemRemove}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Totals */}
      <Card>
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          <CardTitle>Totals</CardTitle>
          <ConfidenceBadge value={fieldConfidence.totals} />
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className={labelClass} htmlFor="subtotal">
              Subtotal
            </label>
            <input
              id="subtotal"
              name="subtotal"
              inputMode="decimal"
              value={form.subtotal}
              onChange={handleTextChange}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="taxTotal">
              Tax total
            </label>
            <input
              id="taxTotal"
              name="taxTotal"
              inputMode="decimal"
              value={form.taxTotal}
              onChange={handleTextChange}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="grandTotal">
              Grand total
            </label>
            <input
              id="grandTotal"
              name="grandTotal"
              inputMode="decimal"
              value={form.grandTotal}
              onChange={handleTextChange}
              className={inputClass}
            />
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <label className="sr-only" htmlFor="overallNotes">
            Notes
          </label>
          <textarea
            id="overallNotes"
            name="overallNotes"
            rows={3}
            value={form.overallNotes}
            onChange={handleTextChange}
            className={inputClass}
          />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" variant="outline" onClick={onReset}>
          <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Upload another
        </Button>
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <Button type="button" variant="outline" onClick={handleConfirm}>
            <CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Mark as verified
          </Button>
          <Button
            type="button"
            variant="success"
            onClick={handleCreatePurchaseBill}
          >
            <FilePlus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Create purchase bill
          </Button>
        </div>
      </div>

      {confirmed && (
        <div
          role="status"
          className="rounded-lg border border-success/30 bg-success/5 px-4 py-3 text-sm text-success-dark"
        >
          Values verified. Choose <strong>Create purchase bill</strong> to carry
          them into a new supplier bill, where you can match the supplier and
          products before saving.
        </div>
      )}
    </motion.div>
  );
}
