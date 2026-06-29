import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type {
  SupplierCatalogItem,
  SupplierCatalogSearchResult,
} from "@/features/cbn/types/cbn.types";
import type { CreateCatalogItemInput } from "@/features/cbn/schemas/catalogSchema";
import { CatalogService } from "./catalog.service";

// ─────────────────────────────────────────────────────────────
// Hoisted mocks
// ─────────────────────────────────────────────────────────────

const { mockRepo, auditLogMock } = vi.hoisted(() => ({
  mockRepo: {
    listByOrg: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
    setPublished: vi.fn(),
    searchConnectedSupplierCatalog: vi.fn(),
  },
  auditLogMock: vi.fn(),
}));

vi.mock("@/features/cbn/repositories/catalog.repository", () => ({
  CatalogRepository: vi.fn(() => mockRepo),
}));

vi.mock("@/features/audit/services/audit.service", () => ({
  AuditService: vi.fn(() => ({ log: auditLogMock })),
}));

// ─────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────

function buildItem(): SupplierCatalogItem {
  return {
    id: "cat-1",
    organizationId: "org-1",
    productId: "prod-1",
    catalogPrice: 100,
    currency: "INR",
    moq: 1,
    leadTimeDays: 7,
    stockAvailability: "available",
    isPublished: false,
    catalogNotes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
  };
}

const createInput: CreateCatalogItemInput = {
  productId: "prod-1",
  catalogPrice: 100,
  currency: "INR",
  moq: 1,
  stockAvailability: "available",
  isPublished: false,
};

/** Builds a supabase stub whose update().eq().is() chain resolves to `error`. */
function makeSupabase(updateError: { message: string } | null = null) {
  const is = vi.fn().mockResolvedValue({ error: updateError });
  const eq = vi.fn().mockReturnValue({ is });
  const update = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ update });
  return {
    client: { from } as unknown as AppSupabaseClient,
    from,
    update,
    eq,
    is,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  auditLogMock.mockResolvedValue(true);
});

// ─────────────────────────────────────────────────────────────
// listMyCatalog
// ─────────────────────────────────────────────────────────────

describe("CatalogService.listMyCatalog", () => {
  it("delegates to the repository", async () => {
    const items = [buildItem()];
    mockRepo.listByOrg.mockResolvedValue(items);
    const service = new CatalogService(makeSupabase().client);

    const result = await service.listMyCatalog("org-1");

    expect(result).toBe(items);
    expect(mockRepo.listByOrg).toHaveBeenCalledWith("org-1");
  });
});

// ─────────────────────────────────────────────────────────────
// createCatalogItem
// ─────────────────────────────────────────────────────────────

describe("CatalogService.createCatalogItem", () => {
  it("creates the item and writes an audit log on success", async () => {
    const item = buildItem();
    mockRepo.upsert.mockResolvedValue(item);
    const service = new CatalogService(makeSupabase().client);

    const result = await service.createCatalogItem("org-1", createInput);

    expect(result).toEqual({ success: true, data: item });
    expect(mockRepo.upsert).toHaveBeenCalledWith("org-1", createInput);
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        action: "cbn.catalog.create",
        entityType: "supplier_catalog_item",
        entityId: "cat-1",
      })
    );
  });

  it("returns unknown when the repository fails to create", async () => {
    mockRepo.upsert.mockResolvedValue(null);
    const service = new CatalogService(makeSupabase().client);

    const result = await service.createCatalogItem("org-1", createInput);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
    expect(auditLogMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// updateCatalogItem
// ─────────────────────────────────────────────────────────────

describe("CatalogService.updateCatalogItem", () => {
  it("updates the item and audits on success", async () => {
    const item = buildItem();
    mockRepo.update.mockResolvedValue(item);
    const service = new CatalogService(makeSupabase().client);

    const result = await service.updateCatalogItem("org-1", "cat-1", {
      catalogPrice: 200,
    });

    expect(result).toEqual({ success: true, data: item });
    expect(mockRepo.update).toHaveBeenCalledWith("cat-1", { catalogPrice: 200 });
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "cbn.catalog.update" })
    );
  });

  it("returns not_found when the item does not exist", async () => {
    mockRepo.update.mockResolvedValue(null);
    const service = new CatalogService(makeSupabase().client);

    const result = await service.updateCatalogItem("org-1", "missing", {});

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
    expect(auditLogMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// togglePublished
// ─────────────────────────────────────────────────────────────

describe("CatalogService.togglePublished", () => {
  it("publishes and audits with the publish action", async () => {
    mockRepo.setPublished.mockResolvedValue(true);
    const service = new CatalogService(makeSupabase().client);

    const result = await service.togglePublished("org-1", "cat-1", true);

    expect(result).toEqual({ success: true, data: undefined });
    expect(mockRepo.setPublished).toHaveBeenCalledWith("cat-1", true);
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "cbn.catalog.publish" })
    );
  });

  it("unpublishes and audits with the unpublish action", async () => {
    mockRepo.setPublished.mockResolvedValue(true);
    const service = new CatalogService(makeSupabase().client);

    await service.togglePublished("org-1", "cat-1", false);

    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "cbn.catalog.unpublish" })
    );
  });

  it("returns not_found when the item does not exist", async () => {
    mockRepo.setPublished.mockResolvedValue(false);
    const service = new CatalogService(makeSupabase().client);

    const result = await service.togglePublished("org-1", "missing", true);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
    expect(auditLogMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// searchSupplierCatalog
// ─────────────────────────────────────────────────────────────

describe("CatalogService.searchSupplierCatalog", () => {
  it("delegates to the repository with defaults", async () => {
    const rows: SupplierCatalogSearchResult[] = [];
    mockRepo.searchConnectedSupplierCatalog.mockResolvedValue(rows);
    const service = new CatalogService(makeSupabase().client);

    const result = await service.searchSupplierCatalog("supplier-1");

    expect(result).toBe(rows);
    expect(mockRepo.searchConnectedSupplierCatalog).toHaveBeenCalledWith(
      "supplier-1",
      undefined,
      20,
      0
    );
  });

  it("forwards query, limit and offset", async () => {
    mockRepo.searchConnectedSupplierCatalog.mockResolvedValue([]);
    const service = new CatalogService(makeSupabase().client);

    await service.searchSupplierCatalog("supplier-1", "widget", 5, 10);

    expect(mockRepo.searchConnectedSupplierCatalog).toHaveBeenCalledWith(
      "supplier-1",
      "widget",
      5,
      10
    );
  });
});

// ─────────────────────────────────────────────────────────────
// enableCatalog
// ─────────────────────────────────────────────────────────────

describe("CatalogService.enableCatalog", () => {
  it("updates the profile and audits on success", async () => {
    const sb = makeSupabase(null);
    const service = new CatalogService(sb.client);

    const result = await service.enableCatalog("org-1");

    expect(result).toEqual({ success: true, data: undefined });
    expect(sb.from).toHaveBeenCalledWith("business_profiles");
    expect(sb.update).toHaveBeenCalledWith({ catalog_enabled: true });
    expect(sb.eq).toHaveBeenCalledWith("organization_id", "org-1");
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "cbn.catalog.enable" })
    );
  });

  it("returns unknown when the update errors", async () => {
    const sb = makeSupabase({ message: "DB down" });
    const service = new CatalogService(sb.client);

    const result = await service.enableCatalog("org-1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
      expect(result.error.message).toBe("DB down");
    }
    expect(auditLogMock).not.toHaveBeenCalled();
  });
});
