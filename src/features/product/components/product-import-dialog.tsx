"use client";

import { useRef, useState, useTransition } from "react";
import { CheckCircle2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/shared/error-banner";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { importProductsAction } from "@/features/product/actions/product.actions";
import { objectsToCsv } from "@/utils/csv";
import { downloadTextFile } from "@/utils/download";
import type { ProductImportResult } from "@/features/product/types/product.types";

// Mirrors the importer's expected columns (product.service CSV contract).
const SAMPLE_COLUMNS = [
  "code",
  "name",
  "type",
  "status",
  "categoryId",
  "brandId",
  "unitId",
  "hsnCode",
  "gstRate",
  "taxInclusive",
  "purchasePrice",
  "sellingPrice",
  "mrp",
  "sku",
  "barcode",
  "reorderLevel",
  "maxStock",
  "openingStock",
  "tags",
  "description",
] as const;

const SAMPLE_ROW: Record<(typeof SAMPLE_COLUMNS)[number], string> = {
  code: "PROD-00001",
  name: "Premium Widget",
  type: "inventory",
  status: "active",
  // Category / brand / unit reference existing IDs — leave blank or paste a valid UUID.
  categoryId: "",
  brandId: "",
  unitId: "",
  hsnCode: "8471",
  gstRate: "18",
  taxInclusive: "false",
  purchasePrice: "100",
  sellingPrice: "150",
  mrp: "199",
  sku: "WIDGET-001",
  barcode: "8901234567890",
  reorderLevel: "10",
  maxStock: "500",
  openingStock: "50",
  tags: "featured;new",
  description: "A premium widget",
};

function downloadSample(): void {
  downloadTextFile(
    "products-import-sample.csv",
    objectsToCsv(SAMPLE_COLUMNS, [SAMPLE_ROW])
  );
}

interface ProductImportDialogProps {
  readonly organizationId: string;
  readonly onClose: () => void;
  readonly onImported?: () => void;
}

export function ProductImportDialog({
  organizationId,
  onClose,
  onImported,
}: ProductImportDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProductImportResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ): void => {
    setFile(event.target.files?.[0] ?? null);
    setError(null);
    setResult(null);
  };

  const handleImport = (): void => {
    if (!file) {
      setError("Please choose a CSV file to import.");
      return;
    }
    setError(null);

    startTransition(async () => {
      const text = await file.text();
      const response = await importProductsAction(organizationId, text);

      if (!response.success) {
        setError(response.error.message);
        return;
      }

      setResult(response.data);
      if (onImported) {
        onImported();
      }
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Import products"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
    >
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <CardTitle>Import products</CardTitle>
              <CardDescription>
                Upload a CSV file to bulk-create products. The first row must
                contain column headers.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              aria-label="Close import dialog"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {!result && (
            <div>
              <label
                htmlFor="product-import-file"
                className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                CSV file
              </label>
              <input
                id="product-import-file"
                ref={inputRef}
                type="file"
                accept=".csv"
                aria-label="CSV file"
                onChange={handleFileChange}
                className="block w-full cursor-pointer rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-300 shadow-sm file:mr-3 file:border-0 file:bg-slate-50 dark:file:bg-slate-800 file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-slate-700 dark:file:text-slate-300 hover:border-slate-400 dark:hover:border-slate-600 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Not sure about the format?{" "}
                <button
                  type="button"
                  onClick={downloadSample}
                  className="font-medium text-primary-600 underline-offset-2 hover:underline dark:text-primary-400"
                >
                  Download sample CSV
                </button>
              </p>
            </div>
          )}

          {error && <ErrorBanner message={error} />}

          {result && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                <CheckCircle2
                  className="text-success h-5 w-5"
                  aria-hidden="true"
                />
                <span>
                  {result.created} created · {result.skipped} skipped
                </span>
              </div>

              {result.errors.length > 0 && (
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {result.errors.length}{" "}
                    {result.errors.length === 1 ? "error" : "errors"}
                  </p>
                  <ul className="max-h-48 space-y-1 overflow-y-auto text-sm text-slate-600 dark:text-slate-400">
                    {result.errors.map((rowError) => (
                      <li key={rowError.row}>
                        <span className="font-medium text-slate-800 dark:text-slate-100">
                          Row {rowError.row}:
                        </span>{" "}
                        {rowError.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>

        <CardFooter className="justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {result ? "Done" : "Cancel"}
          </Button>
          {!result && (
            <Button
              type="button"
              variant="gradient"
              onClick={handleImport}
              loading={isPending}
            >
              <Upload className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Import
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
