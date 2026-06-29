import { describe, expect, it, vi, beforeEach } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod/v4";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { AiContext } from "@/features/ai/types/ai.types";

// ── Mock the provider boundary + audit recorder ──────────────────
const { mockParse, mockCreate, mockGetClient, mockRecord, AiNotConfiguredError } =
  vi.hoisted(() => {
    class AiNotConfiguredError extends Error {
      constructor() {
        super("not configured");
        this.name = "AiNotConfiguredError";
      }
    }
    return {
      mockParse: vi.fn(),
      mockCreate: vi.fn(),
      mockGetClient: vi.fn(),
      mockRecord: vi.fn(),
      AiNotConfiguredError,
    };
  });

vi.mock("@/features/ai/client/anthropic-client", () => ({
  AI_MODELS: { default: "claude-opus-4-8", fast: "claude-haiku-4-5" },
  AiNotConfiguredError,
  isAiConfigured: () => true,
  getAnthropicClient: mockGetClient,
}));

vi.mock("@/features/ai/services/ai-interaction.service", () => ({
  AiInteractionService: vi.fn(() => ({ record: mockRecord, list: vi.fn() })),
}));

import { AiGatewayService } from "./ai-gateway.service";

const fakeSupabase = {} as unknown as AppSupabaseClient;
const context: AiContext = { organizationId: "org-1", userId: "user-1" };
const schema = z.object({ confidence: z.number(), answer: z.string() });

function parsedMessage(over: Record<string, unknown> = {}) {
  return {
    usage: { input_tokens: 100, output_tokens: 40 },
    stop_reason: "end_turn",
    parsed_output: { confidence: 0.9, answer: "ok" },
    content: [],
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetClient.mockReturnValue({
    messages: { parse: mockParse, create: mockCreate },
  });
  mockRecord.mockResolvedValue(null);
});

describe("AiGatewayService.generateStructured", () => {
  it("returns parsed data, usage, and model on success", async () => {
    mockParse.mockResolvedValue(parsedMessage());
    const gateway = new AiGatewayService(fakeSupabase);

    const res = await gateway.generateStructured({
      capability: "forecast",
      context,
      system: "system prompt",
      prompt: "data",
      schema,
    });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.data).toEqual({ confidence: 0.9, answer: "ok" });
      expect(res.data.usage.inputTokens).toBe(100);
      expect(res.data.model).toBe("claude-opus-4-8");
    }
  });

  it("records a success interaction with the extracted confidence", async () => {
    mockParse.mockResolvedValue(parsedMessage());
    const gateway = new AiGatewayService(fakeSupabase);

    await gateway.generateStructured({
      capability: "forecast",
      context,
      system: "s",
      prompt: "p",
      schema,
    });

    expect(mockRecord).toHaveBeenCalledOnce();
    const recorded = mockRecord.mock.calls[0][0];
    expect(recorded.status).toBe("success");
    expect(recorded.capability).toBe("forecast");
    expect(recorded.confidence).toBe(0.9);
  });

  it("maps a model refusal to a typed 'refused' error", async () => {
    mockParse.mockResolvedValue(
      parsedMessage({ stop_reason: "refusal", parsed_output: null })
    );
    const gateway = new AiGatewayService(fakeSupabase);

    const res = await gateway.generateStructured({
      capability: "insight",
      context,
      system: "s",
      prompt: "p",
      schema,
    });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.code).toBe("refused");
    }
    expect(mockRecord.mock.calls[0][0].status).toBe("refused");
  });

  it("maps empty parsed_output to a 'parse_error'", async () => {
    mockParse.mockResolvedValue(parsedMessage({ parsed_output: null }));
    const gateway = new AiGatewayService(fakeSupabase);

    const res = await gateway.generateStructured({
      capability: "report",
      context,
      system: "s",
      prompt: "p",
      schema,
    });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.code).toBe("parse_error");
    }
  });

  it("maps a missing provider key to 'not_configured'", async () => {
    mockGetClient.mockImplementation(() => {
      throw new AiNotConfiguredError();
    });
    const gateway = new AiGatewayService(fakeSupabase);

    const res = await gateway.generateStructured({
      capability: "search",
      context,
      system: "s",
      prompt: "p",
      schema,
    });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.code).toBe("not_configured");
    }
  });

  it("maps a rate-limit error to 'rate_limited'", async () => {
    const rateErr = Object.create(Anthropic.RateLimitError.prototype);
    mockParse.mockRejectedValue(rateErr);
    const gateway = new AiGatewayService(fakeSupabase);

    const res = await gateway.generateStructured({
      capability: "recommendation",
      context,
      system: "s",
      prompt: "p",
      schema,
    });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.code).toBe("rate_limited");
    }
  });

  it("maps an unexpected error to 'unknown'", async () => {
    mockParse.mockRejectedValue(new Error("boom"));
    const gateway = new AiGatewayService(fakeSupabase);

    const res = await gateway.generateStructured({
      capability: "forecast",
      context,
      system: "s",
      prompt: "p",
      schema,
    });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.code).toBe("unknown");
    }
  });
});

describe("AiGatewayService.extractFromDocument", () => {
  it("rejects when neither image nor document is provided", async () => {
    const gateway = new AiGatewayService(fakeSupabase);
    const res = await gateway.extractFromDocument({
      capability: "ocr",
      context,
      system: "s",
      instruction: "extract",
      schema,
    });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.code).toBe("validation");
    }
    expect(mockParse).not.toHaveBeenCalled();
  });

  it("extracts structured data from an image", async () => {
    mockParse.mockResolvedValue(parsedMessage());
    const gateway = new AiGatewayService(fakeSupabase);

    const res = await gateway.extractFromDocument({
      capability: "ocr",
      context,
      system: "s",
      instruction: "extract",
      schema,
      image: { mediaType: "image/png", base64: "abc" },
    });

    expect(res.success).toBe(true);
    expect(mockParse).toHaveBeenCalledOnce();
  });
});

describe("AiGatewayService.runConversation", () => {
  function textResponse(text: string) {
    return {
      usage: { input_tokens: 80, output_tokens: 20 },
      stop_reason: "end_turn",
      content: [{ type: "text", text }],
    };
  }

  it("returns the assistant text on a plain completion", async () => {
    mockCreate.mockResolvedValue(textResponse("Hello there"));
    const gateway = new AiGatewayService(fakeSupabase);

    const res = await gateway.runConversation({
      capability: "assistant",
      context,
      system: "s",
      messages: [{ role: "user", content: "hi" }],
    });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.text).toBe("Hello there");
      expect(res.data.proposedAction).toBeNull();
    }
  });

  it("executes a read tool then completes", async () => {
    mockCreate
      .mockResolvedValueOnce({
        usage: { input_tokens: 50, output_tokens: 10 },
        stop_reason: "tool_use",
        content: [
          { type: "tool_use", id: "tu-1", name: "search_customers", input: { q: "ABC" } },
        ],
      })
      .mockResolvedValueOnce(textResponse("Found ABC Hardware"));

    const execute = vi.fn().mockResolvedValue([{ id: "c1", name: "ABC Hardware" }]);
    const gateway = new AiGatewayService(fakeSupabase);

    const res = await gateway.runConversation({
      capability: "assistant",
      context,
      system: "s",
      messages: [{ role: "user", content: "find ABC" }],
      tools: [
        {
          definition: {
            name: "search_customers",
            description: "search",
            input_schema: { type: "object", properties: {} },
          },
          execute,
        },
      ],
    });

    expect(execute).toHaveBeenCalledWith({ q: "ABC" });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.text).toBe("Found ABC Hardware");
      expect(res.data.toolCalls).toHaveLength(1);
    }
  });

  it("halts on a propose tool and surfaces a proposed action for approval", async () => {
    mockCreate.mockResolvedValue({
      usage: { input_tokens: 60, output_tokens: 15 },
      stop_reason: "tool_use",
      content: [
        { type: "text", text: "I'll prepare that invoice." },
        {
          type: "tool_use",
          id: "tu-2",
          name: "propose_invoice",
          input: { customer: "ABC", items: [{ name: "Cement", qty: 10 }] },
        },
      ],
    });

    const gateway = new AiGatewayService(fakeSupabase);
    const res = await gateway.runConversation({
      capability: "assistant",
      context,
      system: "s",
      messages: [{ role: "user", content: "invoice ABC for 10 cement" }],
      tools: [
        {
          definition: {
            name: "propose_invoice",
            description: "propose",
            input_schema: { type: "object", properties: {} },
          },
          // no execute → propose tool
        },
      ],
    });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.proposedAction).not.toBeNull();
      expect(res.data.proposedAction?.tool).toBe("propose_invoice");
      expect(res.data.proposedAction?.input.customer).toBe("ABC");
    }
    // The propose tool must NOT be executed (it has no executor).
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it("maps a refusal during conversation to 'refused'", async () => {
    mockCreate.mockResolvedValue({
      usage: { input_tokens: 30, output_tokens: 0 },
      stop_reason: "refusal",
      content: [],
    });
    const gateway = new AiGatewayService(fakeSupabase);

    const res = await gateway.runConversation({
      capability: "assistant",
      context,
      system: "s",
      messages: [{ role: "user", content: "..." }],
    });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.code).toBe("refused");
    }
  });
});
