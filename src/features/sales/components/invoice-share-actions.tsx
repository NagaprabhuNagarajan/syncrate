"use client";

import { useState } from "react";
import { Printer, Link2, Check, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InvoiceShareActionsProps {
  readonly pdfUrl: string;
}

/**
 * Client-side actions for the printable invoice share page: copy the
 * shareable link, print, and download. Both Print and Download use the same
 * server-rendered PDF (headless Chromium), so the printed output is identical
 * to the downloaded file — clean, with no app chrome or browser header/footer.
 */
export function InvoiceShareActions({ pdfUrl }: InvoiceShareActionsProps) {
  const [copied, setCopied] = useState(false);
  const [printing, setPrinting] = useState(false);

  const handleCopyLink = (): void => {
    void navigator.clipboard
      .writeText(window.location.href)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => setCopied(false));
  };

  const handlePrint = (): void => {
    setPrinting(true);
    void fetch(pdfUrl)
      .then((res) => {
        if (!res.ok) {
          throw new Error("Failed to render PDF");
        }
        return res.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const iframe = document.createElement("iframe");
        iframe.style.position = "fixed";
        iframe.style.right = "0";
        iframe.style.bottom = "0";
        iframe.style.width = "0";
        iframe.style.height = "0";
        iframe.style.border = "0";
        iframe.src = url;
        iframe.onload = (): void => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          window.setTimeout(() => {
            URL.revokeObjectURL(url);
            iframe.remove();
          }, 60_000);
        };
        document.body.appendChild(iframe);
        setPrinting(false);
      })
      .catch(() => setPrinting(false));
  };

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <Button type="button" variant="outline" size="sm" onClick={handleCopyLink}>
        {copied ? (
          <Check
            className="mr-1.5 h-4 w-4 text-success-600"
            aria-hidden="true"
          />
        ) : (
          <Link2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
        )}
        {copied ? "Link copied" : "Copy link"}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handlePrint}
        loading={printing}
      >
        <Printer className="mr-1.5 h-4 w-4" aria-hidden="true" />
        Print
      </Button>
      <Button asChild variant="gradient" size="sm">
        <a href={pdfUrl}>
          <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Download PDF
        </a>
      </Button>
    </div>
  );
}

InvoiceShareActions.displayName = "InvoiceShareActions";
