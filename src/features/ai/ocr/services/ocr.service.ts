import { AiGatewayService } from "@/features/ai/services/ai-gateway.service";
import { ocrExtractionSchema } from "@/features/ai/ocr/schemas/ocrExtractionSchema";
import type { AiContext } from "@/features/ai/types/ai.types";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type {
  OcrExtractionResponse,
  OcrFileInput,
  OcrResult,
} from "@/features/ai/ocr/types/ocr.types";

/**
 * AI OCR service (spec §7).
 *
 * Builds the frozen extraction prompt + schema and delegates to the AI Gateway,
 * which owns provider access, auditing, timing, and typed error mapping. This
 * service contains NO UI and NO persistence — extraction is reviewed by a human
 * before anything is created (human-in-the-loop, spec §7 acceptance criteria).
 */

const OCR_SYSTEM_PROMPT = `You are an expert document data-extraction engine for Syncrate, an accounting platform for Indian SMEs. You read purchase bills, tax invoices, receipts, delivery challans, and product labels and return structured data.

Rules:
- Extract only what is visibly present. Never invent, infer, or guess a value.
- When a field is absent or illegible, return null for it and lower its confidence.
- Preserve numbers exactly as printed. Do not recompute or "fix" totals.
- Dates must be ISO 8601 (YYYY-MM-DD).
- Currency must be an ISO 4217 code (e.g. INR). Default to INR only when the symbol/context clearly implies Indian Rupees.
- Provide calibrated confidence scores in [0, 1] that reflect your actual certainty, not optimism.
- Your output is reviewed and corrected by a human before any record is created. Favour honest nulls over confident mistakes.`;

const OCR_INSTRUCTION = `Extract the following from the attached document and return it in the required structured format:
- supplier / vendor name
- invoice or bill number
- invoice date (ISO 8601)
- supplier GST number
- every line item: description, quantity, unit price, tax %, line total
- subtotal, total tax, grand total
- currency (ISO 4217)
Also classify the document type, give an overall confidence and per-field confidence, and add a short note about anything ambiguous or unreadable.`;

export class OcrService {
  private readonly gateway: AiGatewayService;

  constructor(supabase: AppSupabaseClient) {
    this.gateway = new AiGatewayService(supabase);
  }

  /** True when an AI provider key is configured. */
  get isConfigured(): boolean {
    return this.gateway.isConfigured;
  }

  /**
   * Extracts structured data from an uploaded image or PDF for human review.
   * The caller (action) is responsible for type/size validation and base64
   * conversion before invoking this method.
   */
  async extract(params: {
    readonly context: AiContext;
    readonly file: OcrFileInput;
  }): Promise<OcrResult<OcrExtractionResponse>> {
    const { context, file } = params;

    const result = await this.gateway.extractFromDocument({
      capability: "ocr",
      context,
      system: OCR_SYSTEM_PROMPT,
      instruction: OCR_INSTRUCTION,
      schema: ocrExtractionSchema,
      ...(file.kind === "image"
        ? { image: { mediaType: file.mediaType, base64: file.base64 } }
        : { document: { pdfBase64: file.base64 } }),
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      data: {
        extraction: result.data.data,
        model: result.data.model,
        usage: result.data.usage,
      },
    };
  }
}
