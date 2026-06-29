import type { MessageParam, Tool } from "@anthropic-ai/sdk/resources/messages";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import { AiGatewayService } from "@/features/ai/services/ai-gateway.service";
import type { AiTool } from "@/features/ai/services/ai-gateway.service";
import type { AiResult } from "@/features/ai/types/ai.types";
import { CustomerService } from "@/features/customer/services/customer.service";
import { SupplierService } from "@/features/supplier/services/supplier.service";
import { ProductService } from "@/features/product/services/product.service";
import { InventoryService } from "@/features/inventory/services/inventory.service";
import { searchToolInputSchema } from "@/features/ai/assistant/schemas/assistant.schemas";
import type {
  AssistantMessage,
  AssistantTurn,
} from "@/features/ai/assistant/types/assistant.types";

/**
 * The AI Business Assistant (spec §6).
 *
 * Wraps the AI Gateway with a frozen system prompt and a set of tenant-scoped
 * tools. Read tools (search_*, check_inventory) execute server-side against the
 * real domain services and feed compact JSON back to the model. The two
 * "propose" tools have NO executor — invoking one halts the gateway loop and
 * surfaces the input as a {@link AssistantTurn.proposedAction} the user must
 * explicitly approve. The assistant therefore never mutates business data.
 */

// Only the gateway/domain methods the assistant actually calls — keeps the
// dependency surface tiny and lets tests inject lightweight fakes.
type GatewayDep = Pick<AiGatewayService, "runConversation">;

export interface AssistantServiceDeps {
  readonly gateway: GatewayDep;
  readonly customers: Pick<CustomerService, "listCustomers">;
  readonly suppliers: Pick<SupplierService, "listSuppliers">;
  readonly products: Pick<ProductService, "listProducts">;
  readonly inventory: Pick<InventoryService, "listLevels">;
}

export interface AssistantChatParams {
  readonly organizationId: string;
  readonly userId: string | null;
  readonly messages: ReadonlyArray<AssistantMessage>;
}

/** How many results each read tool returns by default (kept compact). */
const DEFAULT_TOOL_LIMIT = 5;

/**
 * Frozen system prompt — placed first for prompt-cache stability and to lock
 * the assistant's behaviour: it proposes, it never executes.
 */
export const ASSISTANT_SYSTEM_PROMPT = `You are Syncrate Assistant, an AI helper embedded in Syncrate — a Connected Business Operating System for small and medium businesses in India.

Your job is to help the user understand and act on their business data: customers, suppliers, products, and inventory. Be concise, accurate, and professional. Amounts are in Indian Rupees (INR).

TOOLS
- search_customers, search_suppliers, search_products, check_inventory are READ-ONLY. Use them to look up real records before answering or proposing anything. Never invent IDs, prices, stock levels, or names.
- propose_invoice and propose_quotation PREPARE a draft for the user to review. They do NOT create anything. The user must explicitly approve a proposal before any document is created.

RULES
1. You must NEVER claim to have created, sent, updated, or deleted anything. You can only read data and PROPOSE invoices/quotations.
2. Before proposing an invoice or quotation you MUST resolve the real customerId (via search_customers) and a real productId for every line (via search_products). If you cannot find a match, ask the user to clarify instead of guessing.
3. Default each line's unitPrice to the product's selling price and gstRate to the product's GST rate unless the user specifies otherwise.
4. When you have everything you need to prepare a document, call the matching propose_ tool. Briefly summarise what you are proposing in text as well.
5. If the request is ambiguous or missing required details, ask a short clarifying question rather than proposing.`;

function compact<T>(items: ReadonlyArray<T>, limit: number): T[] {
  return items.slice(0, limit);
}

function parseSearchInput(input: unknown): {
  search?: string;
  pageSize: number;
} {
  const parsed = searchToolInputSchema.safeParse(input);
  if (!parsed.success) {
    return { pageSize: DEFAULT_TOOL_LIMIT };
  }
  return {
    search: parsed.data.query,
    pageSize: parsed.data.limit ?? DEFAULT_TOOL_LIMIT,
  };
}

const SEARCH_QUERY_PROPERTY = {
  query: {
    type: "string" as const,
    description: "Free-text search (name, code, mobile, etc.). Omit to list recent records.",
  },
  limit: {
    type: "integer" as const,
    description: "Max results to return (1-10, default 5).",
  },
};

export class AssistantService {
  private readonly gateway: GatewayDep;
  private readonly customers: Pick<CustomerService, "listCustomers">;
  private readonly suppliers: Pick<SupplierService, "listSuppliers">;
  private readonly products: Pick<ProductService, "listProducts">;
  private readonly inventory: Pick<InventoryService, "listLevels">;

  constructor(
    supabase: AppSupabaseClient,
    deps?: Partial<AssistantServiceDeps>
  ) {
    this.gateway = deps?.gateway ?? new AiGatewayService(supabase);
    this.customers = deps?.customers ?? new CustomerService(supabase);
    this.suppliers = deps?.suppliers ?? new SupplierService(supabase);
    this.products = deps?.products ?? new ProductService(supabase);
    this.inventory = deps?.inventory ?? new InventoryService(supabase);
  }

  /**
   * Runs one assistant turn over the full message history. Returns either the
   * assistant's reply (with any read-tool calls) or a proposed action awaiting
   * approval. The gateway audits the interaction and maps provider errors.
   */
  async chat(params: AssistantChatParams): Promise<AiResult<AssistantTurn>> {
    const messages: MessageParam[] = params.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const result = await this.gateway.runConversation({
      capability: "assistant",
      context: { organizationId: params.organizationId, userId: params.userId },
      system: ASSISTANT_SYSTEM_PROMPT,
      messages,
      tools: this.buildTools(params.organizationId),
    });

    if (!result.success) {
      return result;
    }

    const { text, toolCalls, proposedAction } = result.data;
    return { success: true, data: { text, toolCalls, proposedAction } };
  }

  /** Builds the tenant-scoped tool set for an organization. */
  private buildTools(organizationId: string): AiTool[] {
    return [
      this.searchCustomersTool(organizationId),
      this.searchSuppliersTool(organizationId),
      this.searchProductsTool(organizationId),
      this.checkInventoryTool(organizationId),
      proposeInvoiceTool(),
      proposeQuotationTool(),
    ];
  }

  // ── Read tools (execute present) ───────────────────────────

  private searchCustomersTool(organizationId: string): AiTool {
    return {
      definition: {
        name: "search_customers",
        description:
          "Search the organization's customers by name, code, company, mobile or GST. Returns compact records including the customerId needed to propose an invoice.",
        input_schema: {
          type: "object",
          properties: SEARCH_QUERY_PROPERTY,
          required: [],
        },
      },
      execute: async (input) => {
        const { search, pageSize } = parseSearchInput(input);
        const { items } = await this.customers.listCustomers(organizationId, {
          search,
          status: "active",
          pageSize,
        });
        return compact(items, pageSize).map((c) => ({
          customerId: c.id,
          code: c.code,
          name: c.name,
          company: c.company,
          mobile: c.mobile,
          gstNumber: c.gstNumber,
          city: c.billingCity,
        }));
      },
    };
  }

  private searchSuppliersTool(organizationId: string): AiTool {
    return {
      definition: {
        name: "search_suppliers",
        description:
          "Search the organization's suppliers by name, code, contact or GST. Returns compact records.",
        input_schema: {
          type: "object",
          properties: SEARCH_QUERY_PROPERTY,
          required: [],
        },
      },
      execute: async (input) => {
        const { search, pageSize } = parseSearchInput(input);
        const { items } = await this.suppliers.listSuppliers(organizationId, {
          search,
          status: "active",
          pageSize,
        });
        return compact(items, pageSize).map((s) => ({
          supplierId: s.id,
          code: s.code,
          name: s.name,
          contactPerson: s.contactPerson,
          mobile: s.mobile,
          gstNumber: s.gstNumber,
          city: s.city,
        }));
      },
    };
  }

  private searchProductsTool(organizationId: string): AiTool {
    return {
      definition: {
        name: "search_products",
        description:
          "Search the product catalog by name, code, SKU or barcode. Returns the productId, selling price and GST rate needed to propose line items.",
        input_schema: {
          type: "object",
          properties: SEARCH_QUERY_PROPERTY,
          required: [],
        },
      },
      execute: async (input) => {
        const { search, pageSize } = parseSearchInput(input);
        const { items } = await this.products.listProducts(organizationId, {
          search,
          status: "active",
          pageSize,
        });
        return compact(items, pageSize).map((p) => ({
          productId: p.id,
          code: p.code,
          name: p.name,
          sellingPrice: p.sellingPrice,
          gstRate: p.gstRate,
          hsnCode: p.hsnCode,
          sku: p.sku,
        }));
      },
    };
  }

  private checkInventoryTool(organizationId: string): AiTool {
    return {
      definition: {
        name: "check_inventory",
        description:
          "Check current stock levels across warehouses. Optionally filter by a product search term. Returns quantity on hand and reorder level per product/warehouse.",
        input_schema: {
          type: "object",
          properties: SEARCH_QUERY_PROPERTY,
          required: [],
        },
      },
      execute: async (input) => {
        const { search, pageSize } = parseSearchInput(input);
        const { items } = await this.inventory.listLevels(organizationId, {
          search,
          pageSize,
        });
        return compact(items, pageSize).map((l) => ({
          productId: l.productId,
          productCode: l.productCode,
          productName: l.productName,
          warehouse: l.warehouseName,
          quantity: l.quantity,
          reorderLevel: l.reorderLevel,
        }));
      },
    };
  }
}

// ── Propose tools (NO executor → require human approval) ─────

const PROPOSE_DOCUMENT_INPUT_SCHEMA: Tool["input_schema"] = {
  type: "object",
  properties: {
    customerId: {
      type: "string",
      description: "Resolved customer UUID (from search_customers).",
    },
    customerName: {
      type: "string",
      description: "Customer name, for the review card.",
    },
    notes: { type: "string", description: "Optional notes for the document." },
    items: {
      type: "array",
      description: "Line items.",
      items: {
        type: "object",
        properties: {
          productId: {
            type: "string",
            description: "Resolved product UUID (from search_products).",
          },
          productName: { type: "string" },
          description: { type: "string" },
          quantity: { type: "number" },
          unitPrice: {
            type: "number",
            description: "Price per unit in INR (defaults to selling price).",
          },
          gstRate: {
            type: "number",
            description: "GST percentage: one of 0, 5, 12, 18, 28.",
          },
        },
        required: ["productId", "quantity", "unitPrice"],
      },
    },
  },
  required: ["customerId", "items"],
};

function proposeInvoiceTool(): AiTool {
  return {
    definition: {
      name: "propose_invoice",
      description:
        "Prepare a DRAFT sales invoice for the user to review and approve. This does NOT create the invoice — the user must approve it. Only call once you have resolved a real customerId and a real productId for every line.",
      input_schema: PROPOSE_DOCUMENT_INPUT_SCHEMA,
    },
  };
}

function proposeQuotationTool(): AiTool {
  return {
    definition: {
      name: "propose_quotation",
      description:
        "Prepare a DRAFT quotation for the user to review and approve. This does NOT create the quotation — the user must approve it. Only call once you have resolved a real customerId and a real productId for every line.",
      input_schema: PROPOSE_DOCUMENT_INPUT_SCHEMA,
    },
  };
}
