import { type NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { InvoiceService } from "@/features/sales/services/invoice.service";
import { OrganizationService } from "@/features/organization/services/organization.service";

// Playwright launches a real Chromium — this must run on the Node.js runtime,
// never the Edge runtime, and can take a few seconds on a cold start.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Generates a genuine PDF of the invoice by rendering the /share page in
 * headless Chromium with print media emulated (which isolates the invoice
 * document from the app chrome) and calling page.pdf(). The user's auth
 * cookies are forwarded so the authenticated /share route renders correctly.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  const supabase = await createServerSupabaseClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgService = new OrganizationService(supabase);
  const organizations = await orgService.listUserOrganizations(authData.user.id);
  if (organizations.length === 0) {
    return NextResponse.json({ error: "No organization" }, { status: 403 });
  }

  const invoiceService = new InvoiceService(supabase);
  const result = await invoiceService.getInvoice(id);
  if (!result.success) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const invoice = result.data;
  const hasAccess = organizations.some((o) => o.id === invoice.organizationId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const origin = request.nextUrl.origin;
  const shareUrl = `${origin}/invoices/${id}/share`;

  // Forward the caller's cookies so the headless browser is authenticated.
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookies = cookieHeader
    .split(";")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const eq = pair.indexOf("=");
      return {
        name: pair.slice(0, eq),
        value: pair.slice(eq + 1),
        url: origin,
      };
    });

  const { chromium } = await import("@playwright/test");
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext();
    if (cookies.length > 0) {
      await context.addCookies(cookies);
    }
    const page = await context.newPage();
    await page.goto(shareUrl, { waitUntil: "load", timeout: 30_000 });
    // Print media triggers the share page's isolation CSS (invoice only).
    await page.emulateMedia({ media: "print" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    });

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    );
  } finally {
    await browser.close();
  }
}
