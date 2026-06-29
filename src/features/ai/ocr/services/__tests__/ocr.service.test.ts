import { describe, expect, it, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { AiContext } from "@/features/ai/types/ai.types";
import type { OcrExtraction } from "@/features/ai/ocr/schemas/ocrExtractionSchema";
import { OcrService } from "@/features/ai/ocr/services/ocr.service";

// ─────────────────────────────────────────────────────────────
// Mock the AI Gateway the service instantiates internally
// ─────────────────────────────────────────────────────────────

const { extractMock, gatewayCtor } = vi.hoisted(() => ({
  extractMock: vi.fn(),
  gatewayCtor: vi.fn(),
}));

vi.mock("@/features/ai/services/ai-gateway.service", () => ({
  AiGatewayService: gatewayCtor.mockImplementation(() => ({
    extractFromDocument: extractMock,
    isConfigured: true,
  })),
}));

const fakeSupabase = {} as AppSupabaseClient;
const context: AiContext = { organizationId: "org-1", userId: "user-1" };

function buildExtraction(): OcrExtraction {
  return {
    documentType: "purchase_bill",
    supplierName: "Kumar Traders",
    invoiceNumber: "INV-1",
    invoiceDate: "2026-06-01",
    gstNumber: "22AAAAA0000A1Z5",
    currency: "INR",
    lineItems: [],
    subtotal: 100,
    taxTotal: 18,
    grandTotal: 118,
    confidence: 0.9,
    fieldConfidence: {
      supplierName: 0.9,
      invoiceNumber: 0.9,
      invoiceDate: 0.9,
      gstNumber: 0.8,
      totals: 0.9,
      lineItems: null,
    },
    overallNotes: "",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  gatewayCtor.mockImplementation(() => ({
    extractFromDocument: extractMock,
    isConfigured: true,
  }));
});

describe("OcrService", () => {
  it("returns the extraction on a successful gateway call (image)", async () => {
    const extraction = buildExtraction();
    extractMock.mockResolvedValue({
      success: true,
      data: {
        data: extraction,
        usage: { inputTokens: 10, outputTokens: 20, executionMs: 5 },
        model: "claude-test",
      },
    });

    const service = new OcrService(fakeSupabase);
    const result = await service.extract({
      context,
      file: { kind: "image", mediaType: "image/png", base64: "AAAA" },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.extraction).toEqual(extraction);
      expect(result.data.model).toBe("claude-test");
      expect(result.data.usage.inputTokens).toBe(10);
    }
  });

  it("passes an image input through to the gateway", async () => {
    extractMock.mockResolvedValue({
      success: true,
      data: {
        data: buildExtraction(),
        usage: { inputTokens: 0, outputTokens: 0, executionMs: 0 },
        model: "m",
      },
    });

    const service = new OcrService(fakeSupabase);
    await service.extract({
      context,
      file: { kind: "image", mediaType: "image/jpeg", base64: "IMG" },
    });

    const args = extractMock.mock.calls[0]?.[0];
    expect(args.capability).toBe("ocr");
    expect(args.context).toEqual(context);
    expect(args.image).toEqual({ mediaType: "image/jpeg", base64: "IMG" });
    expect(args.document).toBeUndefined();
    expect(args.schema).toBeDefined();
    expect(typeof args.system).toBe("string");
    expect(typeof args.instruction).toBe("string");
  });

  it("passes a PDF document through to the gateway", async () => {
    extractMock.mockResolvedValue({
      success: true,
      data: {
        data: buildExtraction(),
        usage: { inputTokens: 0, outputTokens: 0, executionMs: 0 },
        model: "m",
      },
    });

    const service = new OcrService(fakeSupabase);
    await service.extract({
      context,
      file: { kind: "pdf", base64: "PDF" },
    });

    const args = extractMock.mock.calls[0]?.[0];
    expect(args.document).toEqual({ pdfBase64: "PDF" });
    expect(args.image).toBeUndefined();
  });

  it("propagates a gateway failure", async () => {
    extractMock.mockResolvedValue({
      success: false,
      error: { code: "rate_limited", message: "busy" },
    });

    const service = new OcrService(fakeSupabase);
    const result = await service.extract({
      context,
      file: { kind: "pdf", base64: "PDF" },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("rate_limited");
      expect(result.error.message).toBe("busy");
    }
  });

  it("exposes the gateway configuration state", () => {
    const service = new OcrService(fakeSupabase);
    expect(service.isConfigured).toBe(true);
  });
});
