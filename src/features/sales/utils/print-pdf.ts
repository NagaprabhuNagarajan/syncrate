/**
 * Fetches a server-rendered PDF and opens the browser print dialog on the PDF
 * itself (via a hidden iframe) — so the printed output has no app chrome and
 * no browser header/footer, identical to downloading the file.
 *
 * Resolves once the print dialog has been triggered (or throws on failure).
 */
export async function printPdfFromUrl(url: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to render PDF");
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.src = objectUrl;
  iframe.onload = (): void => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    window.setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
      iframe.remove();
    }, 60_000);
  };
  document.body.appendChild(iframe);
}
