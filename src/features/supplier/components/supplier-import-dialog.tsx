"use client";

import { useRef, useState, useTransition } from "react";
import { AlertCircle, CheckCircle2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { importSuppliersAction } from "@/features/supplier/actions/supplier.actions";
import type { SupplierImportResult } from "@/features/supplier/types/supplier.types";

interface SupplierImportDialogProps {
  readonly organizationId: string;
  readonly onClose: () => void;
  readonly onImported?: () => void;
}

export function SupplierImportDialog({
  organizationId,
  onClose,
  onImported,
}: SupplierImportDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SupplierImportResult | null>(null);
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
      const response = await importSuppliersAction(organizationId, text);

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
      aria-label="Import suppliers"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
    >
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <CardTitle>Import suppliers</CardTitle>
              <CardDescription>
                Upload a CSV file to bulk-create suppliers. The first row must
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
                htmlFor="supplier-import-file"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                CSV file
              </label>
              <input
                id="supplier-import-file"
                ref={inputRef}
                type="file"
                accept=".csv"
                aria-label="CSV file"
                onChange={handleFileChange}
                className="block w-full cursor-pointer rounded-lg border border-slate-300 bg-white text-sm text-slate-700 shadow-sm file:mr-3 file:border-0 file:bg-slate-50 file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-slate-700 hover:border-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="text-error-700 bg-error-50 border-error-200 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm"
            >
              <AlertCircle
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              <span>{error}</span>
            </p>
          )}

          {result && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                <CheckCircle2
                  className="text-success h-5 w-5"
                  aria-hidden="true"
                />
                <span>
                  {result.created} created · {result.skipped} skipped
                </span>
              </div>

              {result.errors.length > 0 && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                    {result.errors.length}{" "}
                    {result.errors.length === 1 ? "error" : "errors"}
                  </p>
                  <ul className="max-h-48 space-y-1 overflow-y-auto text-sm text-slate-600">
                    {result.errors.map((rowError) => (
                      <li key={rowError.row}>
                        <span className="font-medium text-slate-800">
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
            <Button type="button" onClick={handleImport} loading={isPending}>
              <Upload className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Import
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
