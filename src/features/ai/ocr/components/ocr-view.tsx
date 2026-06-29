"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { motion } from "framer-motion";
import { FileScan, FileText, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState } from "@/components/shared/error-state";
import { extractDocumentAction } from "@/features/ai/ocr/actions/ocr.actions";
import {
  OCR_ACCEPTED_MIME_TYPES,
  OCR_ACCEPT_ATTR,
  OCR_MAX_FILE_BYTES,
} from "@/features/ai/ocr/constants/ocr.constants";
import { OcrVerificationForm } from "@/features/ai/ocr/components/ocr-verification-form";
import type { OcrExtractionResponse } from "@/features/ai/ocr/types/ocr.types";

interface OcrViewProps {
  readonly organizationId: string;
  readonly canGenerate: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function OcrView({ organizationId, canGenerate }: OcrViewProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<OcrExtractionResponse | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSelectFile = useCallback((selected: File | null): void => {
    setError(null);
    if (!selected) {
      setFile(null);
      return;
    }
    if (!OCR_ACCEPTED_MIME_TYPES.includes(selected.type)) {
      setError("Unsupported file type. Upload a JPEG, PNG, GIF, WebP or PDF.");
      setFile(null);
      return;
    }
    if (selected.size > OCR_MAX_FILE_BYTES) {
      setError("File is too large. Maximum size is 10MB.");
      setFile(null);
      return;
    }
    setFile(selected);
  }, []);

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>): void => {
      handleSelectFile(event.target.files?.[0] ?? null);
    },
    [handleSelectFile]
  );

  const handleBrowse = useCallback((): void => {
    inputRef.current?.click();
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>): void => {
      event.preventDefault();
      handleSelectFile(event.dataTransfer.files?.[0] ?? null);
    },
    [handleSelectFile]
  );

  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>): void => {
      event.preventDefault();
    },
    []
  );

  const handleClear = useCallback((): void => {
    setFile(null);
    setError(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }, []);

  const handleExtract = useCallback((): void => {
    if (!file) {
      return;
    }
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    startTransition(async () => {
      const result = await extractDocumentAction(organizationId, formData);
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      setResponse(result.data);
    });
  }, [file, organizationId]);

  const handleReset = useCallback((): void => {
    setResponse(null);
    setFile(null);
    setError(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }, []);

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="AI OCR"
        description="Upload a bill, invoice, receipt, challan or product label and let AI extract the details for you to verify."
        icon={FileScan}
      />

      <div className="mt-6 max-w-4xl">
        {response ? (
          <OcrVerificationForm
            extraction={response.extraction}
            model={response.model}
            onReset={handleReset}
            organizationId={organizationId}
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Upload a document</CardTitle>
              <CardDescription>
                JPEG, PNG, GIF, WebP or PDF — up to 10MB. Extracted data is shown
                for your review and is never saved automatically.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!canGenerate && (
                <div
                  role="note"
                  className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
                >
                  You can view this page but need the “AI generate” permission to
                  run extraction.
                </div>
              )}

              <input
                ref={inputRef}
                type="file"
                accept={OCR_ACCEPT_ATTR}
                onChange={handleInputChange}
                className="sr-only"
                aria-label="Upload document"
              />

              {file ? (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <FileText
                      className="h-5 w-5 shrink-0 text-primary-600"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                        {file.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {formatBytes(file.size)}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove selected file"
                    onClick={handleClear}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </motion.div>
              ) : (
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-muted/30 px-6 py-12 text-center dark:border-slate-700"
                >
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <Upload
                      className="h-6 w-6 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mb-1 text-sm font-medium text-foreground">
                    Drag & drop a document here
                  </p>
                  <p className="mb-4 text-sm text-muted-foreground">
                    or choose a file from your device
                  </p>
                  <Button type="button" variant="outline" onClick={handleBrowse}>
                    <Upload className="mr-1.5 h-4 w-4" aria-hidden="true" />
                    Choose file
                  </Button>
                </div>
              )}

              {error && (
                <ErrorState title="Extraction failed" message={error} />
              )}

              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={handleExtract}
                  loading={isPending}
                  disabled={!file || !canGenerate}
                >
                  <FileScan className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  {isPending ? "Extracting…" : "Extract data"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
