import { describe, it, expect, vi, beforeEach } from "vitest";

// The real gateway pulls in the Anthropic client + env validation. The service
// injects its gateway in these tests, so the real class is never used — stub
// the module to keep the unit test isolated from provider/env wiring.
vi.mock("@/features/ai/services/ai-gateway.service", () => ({
  AiGatewayService: class {
    runConversation(): Promise<never> {
      throw new Error("real gateway should not be used in unit tests");
    }
  },
}));

import {
  AssistantService,
  ASSISTANT_SYSTEM_PROMPT,
} from "@/features/ai/assistant/services/assistant.service";
import type { AssistantServiceDeps } from "@/features/ai/assistant/services/assistant.service";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { AiTool } from "@/features/ai/services/ai-gateway.service";
import type { AiResult } from "@/features/ai/types/ai.types";
import type { AiConversationResult } from "@/features/ai/services/ai-gateway.service";

// A minimal supabase stand-in: the service never touches it because every
// dependency is injected.
const supabase = {} as unknown as AppSupabaseClient;

const ORG = "org-1";
const USER = "user-1";

const USAGE = { inputTokens: 1, outputTokens: 2, executionMs: 3 };
const MODEL = "claude-test";

function listResult<T>(items: T[]) {
  return { items, total: items.length, page: 1, pageSize: items.length };
}

function makeDeps(
  runConversation: AssistantServiceDeps["gateway"]["runConversation"],
  overrides: Partial<Omit<AssistantServiceDeps, "gateway">> = {}
): Partial<AssistantServiceDeps> {
  return {
    gateway: { runConversation },
    customers: {
      listCustomers: vi.fn().mockResolvedValue(listResult([])),
      ...overrides.customers,
    } as AssistantServiceDeps["customers"],
    suppliers: {
      listSuppliers: vi.fn().mockResolvedValue(listResult([])),
      ...overrides.suppliers,
    } as AssistantServiceDeps["suppliers"],
    products: {
      listProducts: vi.fn().mockResolvedValue(listResult([])),
      ...overrides.products,
    } as AssistantServiceDeps["products"],
    inventory: {
      listLevels: vi.fn().mockResolvedValue(listResult([])),
      ...overrides.inventory,
    } as AssistantServiceDeps["inventory"],
  };
}

function ok(
  data: Partial<AiConversationResult>
): AiResult<AiConversationResult> {
  return {
    success: true,
    data: {
      text: "",
      usage: USAGE,
      model: MODEL,
      toolCalls: [],
      proposedAction: null,
      ...data,
    },
  };
}

describe("AssistantService.chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a plain assistant answer and wires the gateway correctly", async () => {
    const runConversation = vi.fn().mockResolvedValue(ok({ text: "Hello!" }));
    const service = new AssistantService(supabase, makeDeps(runConversation));

    const result = await service.chat({
      organizationId: ORG,
      userId: USER,
      messages: [{ role: "user", content: "Hi" }],
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.text).toBe("Hello!");
    expect(result.data.proposedAction).toBeNull();

    // Verify gateway invocation shape.
    expect(runConversation).toHaveBeenCalledTimes(1);
    const opts = runConversation.mock.calls[0]?.[0];
    expect(opts.capability).toBe("assistant");
    expect(opts.system).toBe(ASSISTANT_SYSTEM_PROMPT);
    expect(opts.context).toEqual({ organizationId: ORG, userId: USER });
    expect(opts.messages).toEqual([{ role: "user", content: "Hi" }]);

    // Five tools: four read tools (with execute) + one propose tool (without).
    const tools: AiTool[] = opts.tools;
    expect(tools.map((t) => t.definition.name)).toEqual([
      "search_customers",
      "search_suppliers",
      "search_products",
      "check_inventory",
      "propose_invoice",
    ]);
    const readTools = tools.filter((t) => Boolean(t.execute));
    const proposeTools = tools.filter((t) => !t.execute);
    expect(readTools).toHaveLength(4);
    expect(proposeTools.map((t) => t.definition.name)).toEqual([
      "propose_invoice",
    ]);
  });

  it("executes a read tool against the real service and returns compact data", async () => {
    let toolOutput: unknown;
    const customer = {
      id: "c1",
      code: "CUST-1",
      name: "ABC Hardware",
      company: "ABC Pvt Ltd",
      mobile: "9999999999",
      gstNumber: "29ABCDE",
      billingCity: "Bengaluru",
    };
    const listCustomers = vi
      .fn()
      .mockResolvedValue(listResult([customer]));

    const runConversation = vi.fn(
      async (opts: {
        tools?: readonly AiTool[];
      }): Promise<AiResult<AiConversationResult>> => {
        const tool = (opts.tools ?? []).find(
          (t) => t.definition.name === "search_customers"
        );
        toolOutput = await tool?.execute?.({ query: "ABC" });
        return ok({
          text: "Found ABC Hardware",
          toolCalls: [{ name: "search_customers", input: { query: "ABC" } }],
        });
      }
    );

    const service = new AssistantService(
      supabase,
      makeDeps(
        runConversation as AssistantServiceDeps["gateway"]["runConversation"],
        {
          customers: {
            listCustomers,
          } as unknown as AssistantServiceDeps["customers"],
        }
      )
    );

    const result = await service.chat({
      organizationId: ORG,
      userId: USER,
      messages: [{ role: "user", content: "Find ABC" }],
    });

    expect(result.success).toBe(true);
    expect(listCustomers).toHaveBeenCalledWith(ORG, {
      search: "ABC",
      status: "active",
      pageSize: 5,
    });
    expect(toolOutput).toEqual([
      {
        customerId: "c1",
        code: "CUST-1",
        name: "ABC Hardware",
        company: "ABC Pvt Ltd",
        mobile: "9999999999",
        gstNumber: "29ABCDE",
        city: "Bengaluru",
      },
    ]);
    if (result.success) {
      expect(result.data.toolCalls).toHaveLength(1);
    }
  });

  it("surfaces a proposed action awaiting approval", async () => {
    const proposedAction = {
      tool: "propose_invoice",
      input: {
        customerId: "c1",
        items: [{ productId: "p1", quantity: 10, unitPrice: 350 }],
      },
    };
    const runConversation = vi
      .fn()
      .mockResolvedValue(
        ok({ text: "Here is your draft invoice.", proposedAction })
      );
    const service = new AssistantService(supabase, makeDeps(runConversation));

    const result = await service.chat({
      organizationId: ORG,
      userId: USER,
      messages: [{ role: "user", content: "Invoice ABC for 10 cement bags" }],
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.proposedAction).toEqual(proposedAction);
    expect(result.data.text).toBe("Here is your draft invoice.");
  });

  it("propagates a gateway failure", async () => {
    const runConversation = vi.fn().mockResolvedValue({
      success: false,
      error: { code: "rate_limited", message: "The AI service is busy." },
    } satisfies AiResult<AiConversationResult>);
    const service = new AssistantService(supabase, makeDeps(runConversation));

    const result = await service.chat({
      organizationId: ORG,
      userId: USER,
      messages: [{ role: "user", content: "Hi" }],
    });

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(result.error.code).toBe("rate_limited");
  });
});
