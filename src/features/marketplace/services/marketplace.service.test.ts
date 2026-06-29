import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type {
  MarketplaceBrowseListing,
  MarketplaceListing,
  ReputationSummary,
} from "@/features/marketplace/types/marketplace.types";
import { MarketplaceService } from "./marketplace.service";

// ─────────────────────────────────────────────────────────────
// Mock the repository the service instantiates internally
// ─────────────────────────────────────────────────────────────

const { mockRepo } = vi.hoisted(() => ({
  mockRepo: {
    findById: vi.fn(),
    listOwn: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    setFields: vi.fn(),
    softDelete: vi.fn(),
    browse: vi.fn(),
    getReputation: vi.fn(),
  },
}));

vi.mock("@/features/marketplace/repositories/marketplace.repository", () => ({
  MarketplaceRepository: vi.fn(() => mockRepo),
}));

// ─────────────────────────────────────────────────────────────
// Builders
// ─────────────────────────────────────────────────────────────

function buildListing(
  overrides: Partial<MarketplaceListing> = {}
): MarketplaceListing {
  return {
    id: "list-1",
    organizationId: "org-1",
    listingType: "product",
    productId: null,
    title: "Widgets",
    description: null,
    category: null,
    price: 100,
    currency: "INR",
    unit: null,
    minOrderQty: null,
    isPublished: false,
    status: "active",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    createdBy: "user-1",
    version: 1,
    ...overrides,
  };
}

function buildBrowse(
  overrides: Partial<MarketplaceBrowseListing> = {}
): MarketplaceBrowseListing {
  return {
    id: "browse-1",
    organizationId: "seller-1",
    sellerName: "Acme Co",
    listingType: "product",
    productId: null,
    title: "Bulk widgets",
    description: null,
    category: "Hardware",
    price: 50,
    currency: "INR",
    unit: "box",
    minOrderQty: 10,
    createdAt: new Date("2026-02-01"),
    reputation: null,
    ...overrides,
  };
}

const reputation: ReputationSummary = {
  reviewCount: 4,
  averageRating: 4.5,
  recommendedCount: 3,
  recommendPercent: 75,
};

const supabase = {} as AppSupabaseClient;

function makeService() {
  return new MarketplaceService(supabase);
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────

describe("reads", () => {
  it("listOwnListings delegates to the repository", async () => {
    const listResult = { items: [buildListing()], total: 1, page: 1, pageSize: 20 };
    mockRepo.listOwn.mockResolvedValue(listResult);

    const result = await makeService().listOwnListings("org-1", { page: 1 });

    expect(mockRepo.listOwn).toHaveBeenCalledWith("org-1", { page: 1 });
    expect(result).toBe(listResult);
  });

  it("getListing returns the listing when found", async () => {
    const listing = buildListing();
    mockRepo.findById.mockResolvedValue(listing);

    const result = await makeService().getListing("list-1");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(listing);
    }
  });

  it("getListing returns not_found when missing", async () => {
    mockRepo.findById.mockResolvedValue(null);

    const result = await makeService().getListing("missing");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });
});

// ─────────────────────────────────────────────────────────────
// Create
// ─────────────────────────────────────────────────────────────

describe("createListing", () => {
  it("creates an unpublished, active listing and returns it", async () => {
    const created = buildListing({ title: "New" });
    mockRepo.create.mockResolvedValue(created);

    const result = await makeService().createListing(
      { listingType: "product", title: "New", price: 100 },
      "org-1",
      "user-1"
    );

    expect(result.success).toBe(true);
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: "org-1",
        listing_type: "product",
        title: "New",
        is_published: false,
        status: "active",
        created_by: "user-1",
        currency: "INR",
      })
    );
  });

  it("stores null price for quote-on-request listings", async () => {
    mockRepo.create.mockResolvedValue(buildListing({ price: null }));

    await makeService().createListing(
      { listingType: "supplier", title: "Quote me" },
      "org-1",
      "user-1"
    );

    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ price: null })
    );
  });

  it("returns unknown when the repository fails", async () => {
    mockRepo.create.mockResolvedValue(null);

    const result = await makeService().createListing(
      { listingType: "product", title: "x" },
      "org-1",
      "user-1"
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });
});

// ─────────────────────────────────────────────────────────────
// Update (optimistic lock)
// ─────────────────────────────────────────────────────────────

describe("updateListing", () => {
  it("updates with the expected version and returns the new listing", async () => {
    mockRepo.findById.mockResolvedValue(buildListing({ version: 2 }));
    mockRepo.update.mockResolvedValue(buildListing({ version: 3, title: "Edited" }));

    const result = await makeService().updateListing(
      "list-1",
      { listingType: "product", title: "Edited", version: 2 },
      "user-2"
    );

    expect(result.success).toBe(true);
    expect(mockRepo.update).toHaveBeenCalledWith(
      "list-1",
      expect.objectContaining({ title: "Edited" }),
      "user-2",
      2
    );
  });

  it("returns not_found when the listing does not exist", async () => {
    mockRepo.findById.mockResolvedValue(null);

    const result = await makeService().updateListing(
      "missing",
      { listingType: "product", title: "x", version: 1 },
      "user-1"
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
    expect(mockRepo.update).not.toHaveBeenCalled();
  });

  it("returns conflict when the optimistic lock fails", async () => {
    mockRepo.findById.mockResolvedValue(buildListing({ version: 5 }));
    mockRepo.update.mockResolvedValue(null);

    const result = await makeService().updateListing(
      "list-1",
      { listingType: "product", title: "Stale", version: 2 },
      "user-1"
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("conflict");
    }
  });
});

// ─────────────────────────────────────────────────────────────
// Publish
// ─────────────────────────────────────────────────────────────

describe("setPublished", () => {
  it("publishes an active listing", async () => {
    mockRepo.findById.mockResolvedValue(buildListing({ status: "active" }));
    mockRepo.setFields.mockResolvedValue(buildListing({ isPublished: true }));

    const result = await makeService().setPublished("list-1", true, "user-1");

    expect(result.success).toBe(true);
    expect(mockRepo.setFields).toHaveBeenCalledWith(
      "list-1",
      { is_published: true },
      "user-1"
    );
  });

  it("refuses to publish an archived listing", async () => {
    mockRepo.findById.mockResolvedValue(buildListing({ status: "archived" }));

    const result = await makeService().setPublished("list-1", true, "user-1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("validation");
    }
    expect(mockRepo.setFields).not.toHaveBeenCalled();
  });

  it("returns not_found when the listing is missing", async () => {
    mockRepo.findById.mockResolvedValue(null);

    const result = await makeService().setPublished("x", true, "user-1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });
});

// ─────────────────────────────────────────────────────────────
// Status change
// ─────────────────────────────────────────────────────────────

describe("changeStatus", () => {
  it("activates a listing without touching visibility", async () => {
    mockRepo.findById.mockResolvedValue(buildListing({ status: "paused" }));
    mockRepo.setFields.mockResolvedValue(buildListing({ status: "active" }));

    const result = await makeService().changeStatus("list-1", "active", "user-1");

    expect(result.success).toBe(true);
    expect(mockRepo.setFields).toHaveBeenCalledWith(
      "list-1",
      { status: "active" },
      "user-1"
    );
  });

  it("pausing a listing also unpublishes it", async () => {
    mockRepo.findById.mockResolvedValue(buildListing({ isPublished: true }));
    mockRepo.setFields.mockResolvedValue(buildListing({ status: "paused" }));

    await makeService().changeStatus("list-1", "paused", "user-1");

    expect(mockRepo.setFields).toHaveBeenCalledWith(
      "list-1",
      { status: "paused", is_published: false },
      "user-1"
    );
  });
});

// ─────────────────────────────────────────────────────────────
// Archive (soft delete)
// ─────────────────────────────────────────────────────────────

describe("archiveListing", () => {
  it("soft-deletes an existing listing", async () => {
    mockRepo.findById.mockResolvedValue(buildListing());
    mockRepo.softDelete.mockResolvedValue(true);

    const result = await makeService().archiveListing("list-1", "user-1");

    expect(result.success).toBe(true);
    expect(mockRepo.softDelete).toHaveBeenCalledWith("list-1", "user-1");
  });

  it("returns not_found when the listing does not exist", async () => {
    mockRepo.findById.mockResolvedValue(null);

    const result = await makeService().archiveListing("x", "user-1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });

  it("returns unknown when the soft delete fails", async () => {
    mockRepo.findById.mockResolvedValue(buildListing());
    mockRepo.softDelete.mockResolvedValue(false);

    const result = await makeService().archiveListing("list-1", "user-1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });
});

// ─────────────────────────────────────────────────────────────
// Browse (RPC)
// ─────────────────────────────────────────────────────────────

describe("browseListings", () => {
  it("returns mapped rows and reports hasMore when an extra row exists", async () => {
    // pageSize 24 → service requests 25; return 25 to signal a next page.
    const rows = Array.from({ length: 25 }, (_, i) =>
      buildBrowse({ id: `b-${i}` })
    );
    mockRepo.browse.mockResolvedValue(rows);

    const result = await makeService().browseListings({ query: "widget" });

    expect(mockRepo.browse).toHaveBeenCalledWith(
      { query: "widget" },
      25,
      0
    );
    expect(result.items).toHaveLength(24);
    expect(result.hasMore).toBe(true);
  });

  it("reports hasMore=false when fewer than a full page is returned", async () => {
    mockRepo.browse.mockResolvedValue([buildBrowse()]);

    const result = await makeService().browseListings({});

    expect(result.items).toHaveLength(1);
    expect(result.hasMore).toBe(false);
  });

  it("returns an empty result when the RPC yields nothing", async () => {
    mockRepo.browse.mockResolvedValue([]);

    const result = await makeService().browseListings({});

    expect(result.items).toEqual([]);
    expect(result.hasMore).toBe(false);
  });

  it("computes the offset from the requested page", async () => {
    mockRepo.browse.mockResolvedValue([]);

    await makeService().browseListings({ page: 3, pageSize: 10 });

    expect(mockRepo.browse).toHaveBeenCalledWith(
      { page: 3, pageSize: 10 },
      11,
      20
    );
  });

  it("attaches reputation once per distinct seller when requested", async () => {
    mockRepo.browse.mockResolvedValue([
      buildBrowse({ id: "a", organizationId: "seller-1" }),
      buildBrowse({ id: "b", organizationId: "seller-1" }),
      buildBrowse({ id: "c", organizationId: "seller-2" }),
    ]);
    mockRepo.getReputation.mockResolvedValue(reputation);

    const result = await makeService().browseListings(
      {},
      { withReputation: true }
    );

    // Two distinct seller orgs → two reputation lookups.
    expect(mockRepo.getReputation).toHaveBeenCalledTimes(2);
    expect(result.items.every((i) => i.reputation === reputation)).toBe(true);
  });

  it("does not fetch reputation when not requested", async () => {
    mockRepo.browse.mockResolvedValue([buildBrowse()]);

    const result = await makeService().browseListings({});

    expect(mockRepo.getReputation).not.toHaveBeenCalled();
    expect(result.items[0]?.reputation).toBeNull();
  });
});
