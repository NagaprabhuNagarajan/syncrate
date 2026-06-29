import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import { SharedDocumentRepository } from "./shared-document.repository";
import type { ShareDocumentInput } from "@/features/cbn/types/cbn.types";

type DbRow = Database["public"]["Tables"]["cbn_shared_documents"]["Row"];

interface QueryResult {
  data: unknown;
  error: unknown;
}

interface MockBuilder {
  select: Mock;
  eq: Mock;
  is: Mock;
  order: Mock;
  range: Mock;
  insert: Mock;
  update: Mock;
  single: Mock;
}

interface MockClient {
  client: AppSupabaseClient;
  from: Mock;
  builders: MockBuilder[];
}

function createMockClient(results: QueryResult[]): MockClient {
  const builders: MockBuilder[] = [];
  let index = 0;

  const from = vi.fn(() => {
    const result = results[index] ?? { data: null, error: null };
    index += 1;

    const builder: MockBuilder & {
      then: (
        onFulfilled?: ((value: QueryResult) => unknown) | null,
        onRejected?: ((reason: unknown) => unknown) | null
      ) => Promise<unknown>;
    } = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      is: vi.fn(() => builder),
      order: vi.fn(() => builder),
      range: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      single: vi.fn(() => Promise.resolve(result)),
      then: (onFulfilled, onRejected) =>
        Promise.resolve(result).then(onFulfilled, onRejected),
    };

    builders.push(builder);
    return builder;
  });

  const client = { from } as unknown as AppSupabaseClient;
  return { client, from, builders };
}

function buildRow(overrides: Partial<DbRow> = {}): DbRow {
  return {
    id: "doc-1",
    organization_id: "org-1",
    counterparty_organization_id: "org-2",
    connection_id: "conn-1",
    document_type: "tax_invoice",
    document_reference_type: "invoice",
    document_reference_id: "ref-1",
    document_number: "DOC-001",
    document_date: "2026-01-01",
    amount: 1000,
    currency: "INR",
    file_url: "https://files.test/doc.pdf",
    file_name: "doc.pdf",
    status: "active",
    notes: "note",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
    deleted_at: null,
    created_by: "user-1",
    updated_by: null,
    deleted_by: null,
    version: 1,
    ...overrides,
  };
}

describe("SharedDocumentRepository", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("findByConnection", () => {
    it("maps rows with amount and date conversions", async () => {
      const rows = [
        buildRow({ id: "d1", amount: "1500.5" as unknown as number }),
        buildRow({ id: "d2", amount: null }),
      ];
      const { client, builders } = createMockClient([
        { data: rows, error: null },
      ]);
      const repo = new SharedDocumentRepository(client);

      const items = await repo.findByConnection("conn-1");
      expect(items.map((d) => d.id)).toEqual(["d1", "d2"]);
      expect(items[0].amount).toBe(1500.5);
      expect(items[1].amount).toBeNull();
      expect(items[0].documentDate).toBe("2026-01-01");
      expect(items[0].createdAt).toBeInstanceOf(Date);
      expect(builders[0].eq).toHaveBeenCalledWith("connection_id", "conn-1");
      expect(builders[0].is).toHaveBeenCalledWith("deleted_at", null);
      expect(builders[0].order).toHaveBeenCalledWith("created_at", {
        ascending: false,
      });
    });

    it("applies status + pagination params", async () => {
      const { client, builders } = createMockClient([
        { data: [buildRow()], error: null },
      ]);
      const repo = new SharedDocumentRepository(client);

      await repo.findByConnection("conn-1", {
        status: "revoked",
        limit: 5,
        offset: 10,
      });
      expect(builders[0].eq).toHaveBeenCalledWith("status", "revoked");
      expect(builders[0].range).toHaveBeenCalledWith(10, 14);
    });

    it("returns [] on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new SharedDocumentRepository(client);
      expect(await repo.findByConnection("conn-1")).toEqual([]);
    });
  });

  describe("findBySenderOrg", () => {
    it("filters by organization_id and applies limit from offset 0", async () => {
      const { client, builders } = createMockClient([
        { data: [buildRow()], error: null },
      ]);
      const repo = new SharedDocumentRepository(client);

      await repo.findBySenderOrg("org-1", { status: "active", limit: 3 });
      expect(builders[0].eq).toHaveBeenCalledWith("organization_id", "org-1");
      expect(builders[0].eq).toHaveBeenCalledWith("status", "active");
      expect(builders[0].range).toHaveBeenCalledWith(0, 2);
    });

    it("returns [] on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new SharedDocumentRepository(client);
      expect(await repo.findBySenderOrg("org-1")).toEqual([]);
    });
  });

  describe("findByReceiverOrg", () => {
    it("filters by counterparty_organization_id", async () => {
      const { client, builders } = createMockClient([
        { data: [buildRow()], error: null },
      ]);
      const repo = new SharedDocumentRepository(client);

      const items = await repo.findByReceiverOrg("org-2");
      expect(items).toHaveLength(1);
      expect(builders[0].eq).toHaveBeenCalledWith(
        "counterparty_organization_id",
        "org-2"
      );
      expect(builders[0].range).not.toHaveBeenCalled();
    });

    it("applies status + pagination params", async () => {
      const { client, builders } = createMockClient([
        { data: [buildRow()], error: null },
      ]);
      const repo = new SharedDocumentRepository(client);

      await repo.findByReceiverOrg("org-2", {
        status: "superseded",
        limit: 7,
        offset: 14,
      });
      expect(builders[0].eq).toHaveBeenCalledWith("status", "superseded");
      expect(builders[0].range).toHaveBeenCalledWith(14, 20);
    });

    it("returns [] on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new SharedDocumentRepository(client);
      expect(await repo.findByReceiverOrg("org-2")).toEqual([]);
    });
  });

  describe("create", () => {
    it("maps input to insert payload applying defaults for omitted fields", async () => {
      const row = buildRow();
      const { client, builders } = createMockClient([
        { data: row, error: null },
      ]);
      const repo = new SharedDocumentRepository(client);

      const input: ShareDocumentInput = {
        organizationId: "org-1",
        counterpartyOrganizationId: "org-2",
        connectionId: "conn-1",
        documentType: "tax_invoice",
      };
      const doc = await repo.create(input);

      expect(doc?.id).toBe("doc-1");
      const insertArg = builders[0].insert.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(insertArg.organization_id).toBe("org-1");
      expect(insertArg.counterparty_organization_id).toBe("org-2");
      expect(insertArg.connection_id).toBe("conn-1");
      expect(insertArg.document_type).toBe("tax_invoice");
      expect(insertArg.document_reference_type).toBeNull();
      expect(insertArg.document_reference_id).toBeNull();
      expect(insertArg.document_number).toBeNull();
      expect(insertArg.document_date).toBeNull();
      expect(insertArg.amount).toBeNull();
      expect(insertArg.currency).toBe("INR");
      expect(insertArg.file_url).toBeNull();
      expect(insertArg.file_name).toBeNull();
      expect(insertArg.notes).toBeNull();
      expect(insertArg.status).toBe("active");
    });

    it("passes through all provided optional fields", async () => {
      const { client, builders } = createMockClient([
        { data: buildRow(), error: null },
      ]);
      const repo = new SharedDocumentRepository(client);

      await repo.create({
        organizationId: "org-1",
        counterpartyOrganizationId: "org-2",
        connectionId: "conn-1",
        documentType: "quotation",
        documentReferenceType: "quotation",
        documentReferenceId: "q-1",
        documentNumber: "Q-001",
        documentDate: "2026-03-01",
        amount: 250,
        currency: "USD",
        fileUrl: "https://files.test/q.pdf",
        fileName: "q.pdf",
        notes: "hi",
      });
      const insertArg = builders[0].insert.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(insertArg.currency).toBe("USD");
      expect(insertArg.amount).toBe(250);
      expect(insertArg.document_number).toBe("Q-001");
      expect(insertArg.notes).toBe("hi");
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new SharedDocumentRepository(client);
      expect(
        await repo.create({
          organizationId: "org-1",
          counterpartyOrganizationId: "org-2",
          connectionId: "conn-1",
          documentType: "other",
        })
      ).toBeNull();
    });

    it("returns null when no data", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const repo = new SharedDocumentRepository(client);
      expect(
        await repo.create({
          organizationId: "org-1",
          counterpartyOrganizationId: "org-2",
          connectionId: "conn-1",
          documentType: "other",
        })
      ).toBeNull();
    });
  });

  describe("revoke", () => {
    it("sets status revoked and returns true on success", async () => {
      const { client, builders } = createMockClient([
        { data: null, error: null },
      ]);
      const repo = new SharedDocumentRepository(client);

      const ok = await repo.revoke("doc-1");
      expect(ok).toBe(true);
      const patch = builders[0].update.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(patch.status).toBe("revoked");
      expect(builders[0].eq).toHaveBeenCalledWith("id", "doc-1");
      expect(builders[0].is).toHaveBeenCalledWith("deleted_at", null);
    });

    it("returns false on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new SharedDocumentRepository(client);
      expect(await repo.revoke("doc-1")).toBe(false);
    });
  });
});
