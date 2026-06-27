import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import { OrganizationRepository } from "./organization.repository";

type DbOrg = Database["public"]["Tables"]["organizations"]["Row"];
type DbBranch = Database["public"]["Tables"]["branches"]["Row"];
type DbMember = Database["public"]["Tables"]["organization_members"]["Row"];
type DbInvitation =
  Database["public"]["Tables"]["organization_invitations"]["Row"];
type DbRole = Database["public"]["Tables"]["roles"]["Row"];
type DbPermission = Database["public"]["Tables"]["permissions"]["Row"];

// ─────────────────────────────────────────────────────────────
// Chainable Supabase mock
// ─────────────────────────────────────────────────────────────

interface QueryResult {
  data: unknown;
  error: unknown;
}

interface MockBuilder {
  select: Mock;
  eq: Mock;
  is: Mock;
  in: Mock;
  or: Mock;
  order: Mock;
  update: Mock;
  insert: Mock;
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
      in: vi.fn(() => builder),
      or: vi.fn(() => builder),
      order: vi.fn(() => builder),
      update: vi.fn(() => builder),
      insert: vi.fn(() => builder),
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

// ─────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────

function buildDbOrg(overrides: Partial<DbOrg> = {}): DbOrg {
  return {
    id: "org-1",
    name: "Acme Co",
    slug: "acme-co",
    display_name: "Acme",
    business_type: "retail",
    gst_number: "GST123",
    pan_number: "PAN123",
    cin_number: "CIN123",
    phone: "+910000000000",
    email: "info@acme.test",
    website: "https://acme.test",
    address_line1: "Line 1",
    address_line2: "Line 2",
    city: "Chennai",
    state: "TN",
    country: "IN",
    pincode: "600001",
    logo_url: "https://acme.test/logo.png",
    verification_status: "trusted",
    status: "active",
    plan: "professional",
    plan_expires_at: "2027-01-01T00:00:00.000Z",
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

function buildDbBranch(overrides: Partial<DbBranch> = {}): DbBranch {
  return {
    id: "branch-1",
    organization_id: "org-1",
    name: "HQ",
    code: "HQ01",
    is_headquarters: true,
    phone: "+911111111111",
    email: "hq@acme.test",
    address_line1: "HQ Line 1",
    address_line2: null,
    city: "Chennai",
    state: "TN",
    pincode: "600001",
    gst_number: "GSTHQ",
    status: "active",
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

function buildDbMember(overrides: Partial<DbMember> = {}): DbMember {
  return {
    id: "member-1",
    organization_id: "org-1",
    user_id: "user-1",
    role_id: "role-1",
    branch_id: "branch-1",
    status: "active",
    invited_at: "2026-01-01T00:00:00.000Z",
    joined_at: "2026-01-03T00:00:00.000Z",
    invited_by: "user-2",
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

function buildDbInvitation(
  overrides: Partial<DbInvitation> = {}
): DbInvitation {
  return {
    id: "inv-1",
    organization_id: "org-1",
    email: "invitee@acme.test",
    full_name: "Invitee",
    role_id: "role-1",
    branch_id: "branch-1",
    token: "tok-123",
    status: "pending",
    expires_at: "2026-02-01T00:00:00.000Z",
    accepted_at: "2026-01-10T00:00:00.000Z",
    accepted_by: "user-9",
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

function buildDbRole(overrides: Partial<DbRole> = {}): DbRole {
  return {
    id: "role-1",
    organization_id: "org-1",
    name: "Admin",
    description: "Administrator",
    is_system: false,
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

function buildDbPermission(
  overrides: Partial<DbPermission> = {}
): DbPermission {
  return {
    id: "perm-1",
    module: "invoice",
    action: "create",
    name: "invoice.create",
    description: "Create invoices",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
    deleted_at: null,
    created_by: null,
    updated_by: null,
    deleted_by: null,
    version: 1,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("OrganizationRepository", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ── Organizations ──────────────────────────────────────────

  describe("findById", () => {
    it("maps a DB org row to the domain Organization", async () => {
      const row = buildDbOrg();
      const { client, builders } = createMockClient([
        { data: row, error: null },
      ]);
      const repo = new OrganizationRepository(client);

      const org = await repo.findById("org-1");

      expect(org).toEqual({
        id: "org-1",
        name: "Acme Co",
        slug: "acme-co",
        displayName: "Acme",
        businessType: "retail",
        gstNumber: "GST123",
        panNumber: "PAN123",
        cinNumber: "CIN123",
        phone: "+910000000000",
        email: "info@acme.test",
        website: "https://acme.test",
        addressLine1: "Line 1",
        addressLine2: "Line 2",
        city: "Chennai",
        state: "TN",
        country: "IN",
        pincode: "600001",
        logoUrl: "https://acme.test/logo.png",
        verificationStatus: "trusted",
        status: "active",
        plan: "professional",
        planExpiresAt: new Date("2027-01-01T00:00:00.000Z"),
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        createdBy: "user-1",
      });
      expect(builders[0].eq).toHaveBeenCalledWith("id", "org-1");
      expect(builders[0].is).toHaveBeenCalledWith("deleted_at", null);
    });

    it("maps planExpiresAt to null when not set", async () => {
      const row = buildDbOrg({ plan_expires_at: null });
      const { client } = createMockClient([{ data: row, error: null }]);
      const repo = new OrganizationRepository(client);

      const org = await repo.findById("org-1");
      expect(org?.planExpiresAt).toBeNull();
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "boom" } },
      ]);
      const repo = new OrganizationRepository(client);
      expect(await repo.findById("org-1")).toBeNull();
    });

    it("returns null when no data", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const repo = new OrganizationRepository(client);
      expect(await repo.findById("org-1")).toBeNull();
    });
  });

  describe("findBySlug", () => {
    it("maps the org on success", async () => {
      const row = buildDbOrg();
      const { client, builders } = createMockClient([
        { data: row, error: null },
      ]);
      const repo = new OrganizationRepository(client);

      const org = await repo.findBySlug("acme-co");
      expect(org?.slug).toBe("acme-co");
      expect(builders[0].eq).toHaveBeenCalledWith("slug", "acme-co");
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new OrganizationRepository(client);
      expect(await repo.findBySlug("nope")).toBeNull();
    });

    it("returns null when no data", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const repo = new OrganizationRepository(client);
      expect(await repo.findBySlug("nope")).toBeNull();
    });
  });

  describe("findAllForUser", () => {
    it("returns mapped orgs after resolving member org ids", async () => {
      const orgA = buildDbOrg({ id: "org-1", name: "Acme" });
      const orgB = buildDbOrg({ id: "org-2", name: "Beta" });
      const { client, builders } = createMockClient([
        {
          data: [{ organization_id: "org-1" }, { organization_id: "org-2" }],
          error: null,
        },
        { data: [orgA, orgB], error: null },
      ]);
      const repo = new OrganizationRepository(client);

      const orgs = await repo.findAllForUser("user-1");

      expect(orgs.map((o) => o.id)).toEqual(["org-1", "org-2"]);
      expect(builders[1].in).toHaveBeenCalledWith("id", ["org-1", "org-2"]);
    });

    it("returns [] when member lookup errors", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new OrganizationRepository(client);
      expect(await repo.findAllForUser("user-1")).toEqual([]);
    });

    it("returns [] when member data is null", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const repo = new OrganizationRepository(client);
      expect(await repo.findAllForUser("user-1")).toEqual([]);
    });

    it("returns [] when the user has no active memberships", async () => {
      const { client } = createMockClient([{ data: [], error: null }]);
      const repo = new OrganizationRepository(client);
      expect(await repo.findAllForUser("user-1")).toEqual([]);
    });

    it("returns [] when the org fetch errors", async () => {
      const { client } = createMockClient([
        { data: [{ organization_id: "org-1" }], error: null },
        { data: null, error: { message: "fail" } },
      ]);
      const repo = new OrganizationRepository(client);
      expect(await repo.findAllForUser("user-1")).toEqual([]);
    });

    it("returns [] when the org fetch returns null data", async () => {
      const { client } = createMockClient([
        { data: [{ organization_id: "org-1" }], error: null },
        { data: null, error: null },
      ]);
      const repo = new OrganizationRepository(client);
      expect(await repo.findAllForUser("user-1")).toEqual([]);
    });
  });

  describe("create", () => {
    it("inserts with defaults and maps the created org", async () => {
      const row = buildDbOrg();
      const { client, builders } = createMockClient([
        { data: row, error: null },
      ]);
      const repo = new OrganizationRepository(client);

      const org = await repo.create({
        name: "Acme Co",
        slug: "acme-co",
        createdBy: "user-1",
      });

      expect(org?.id).toBe("org-1");
      const insertArg = builders[0].insert.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(insertArg.name).toBe("Acme Co");
      expect(insertArg.slug).toBe("acme-co");
      expect(insertArg.country).toBe("IN");
      expect(insertArg.business_type).toBeNull();
      expect(insertArg.gst_number).toBeNull();
      expect(insertArg.created_by).toBe("user-1");
    });

    it("passes through provided optional fields", async () => {
      const row = buildDbOrg();
      const { client, builders } = createMockClient([
        { data: row, error: null },
      ]);
      const repo = new OrganizationRepository(client);

      await repo.create({
        name: "Acme Co",
        slug: "acme-co",
        businessType: "retail",
        gstNumber: "GST999",
        country: "US",
        city: "NYC",
        createdBy: "user-1",
      });

      const insertArg = builders[0].insert.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(insertArg.business_type).toBe("retail");
      expect(insertArg.gst_number).toBe("GST999");
      expect(insertArg.country).toBe("US");
      expect(insertArg.city).toBe("NYC");
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "dup" } },
      ]);
      const repo = new OrganizationRepository(client);
      expect(
        await repo.create({ name: "X", slug: "x", createdBy: "user-1" })
      ).toBeNull();
    });

    it("returns null when no data", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const repo = new OrganizationRepository(client);
      expect(
        await repo.create({ name: "X", slug: "x", createdBy: "user-1" })
      ).toBeNull();
    });
  });

  describe("update", () => {
    it("applies the patch, sets updated_at, and maps the result", async () => {
      const row = buildDbOrg({ name: "Renamed" });
      const { client, builders } = createMockClient([
        { data: row, error: null },
      ]);
      const repo = new OrganizationRepository(client);

      const org = await repo.update("org-1", { name: "Renamed" });

      expect(org?.name).toBe("Renamed");
      const patchArg = builders[0].update.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(patchArg.name).toBe("Renamed");
      expect(typeof patchArg.updated_at).toBe("string");
      expect(builders[0].is).toHaveBeenCalledWith("deleted_at", null);
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new OrganizationRepository(client);
      expect(await repo.update("org-1", { name: "x" })).toBeNull();
    });

    it("returns null when no data", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const repo = new OrganizationRepository(client);
      expect(await repo.update("org-1", { name: "x" })).toBeNull();
    });
  });

  // ── Branches ──────────────────────────────────────────────

  describe("findBranchesByOrg", () => {
    it("maps a list of branches", async () => {
      const b1 = buildDbBranch({ id: "branch-1" });
      const b2 = buildDbBranch({ id: "branch-2", is_headquarters: false });
      const { client, builders } = createMockClient([
        { data: [b1, b2], error: null },
      ]);
      const repo = new OrganizationRepository(client);

      const branches = await repo.findBranchesByOrg("org-1");

      expect(branches.map((b) => b.id)).toEqual(["branch-1", "branch-2"]);
      expect(branches[0].organizationId).toBe("org-1");
      expect(branches[0].isHeadquarters).toBe(true);
      expect(branches[0].createdAt).toBeInstanceOf(Date);
      expect(builders[0].eq).toHaveBeenCalledWith("organization_id", "org-1");
      expect(builders[0].order).toHaveBeenCalledWith("is_headquarters", {
        ascending: false,
      });
    });

    it("returns [] on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new OrganizationRepository(client);
      expect(await repo.findBranchesByOrg("org-1")).toEqual([]);
    });

    it("returns [] when no data", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const repo = new OrganizationRepository(client);
      expect(await repo.findBranchesByOrg("org-1")).toEqual([]);
    });
  });

  describe("findBranchById", () => {
    it("maps a single branch", async () => {
      const row = buildDbBranch();
      const { client } = createMockClient([{ data: row, error: null }]);
      const repo = new OrganizationRepository(client);

      const branch = await repo.findBranchById("branch-1");
      expect(branch?.code).toBe("HQ01");
      expect(branch?.status).toBe("active");
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new OrganizationRepository(client);
      expect(await repo.findBranchById("branch-1")).toBeNull();
    });

    it("returns null when no data", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const repo = new OrganizationRepository(client);
      expect(await repo.findBranchById("branch-1")).toBeNull();
    });
  });

  describe("findBranchByCode", () => {
    it("uppercases/trims the code and maps the branch", async () => {
      const row = buildDbBranch();
      const { client, builders } = createMockClient([
        { data: row, error: null },
      ]);
      const repo = new OrganizationRepository(client);

      const branch = await repo.findBranchByCode("org-1", "  hq01  ");
      expect(branch?.id).toBe("branch-1");
      expect(builders[0].eq).toHaveBeenCalledWith("organization_id", "org-1");
      expect(builders[0].eq).toHaveBeenCalledWith("code", "HQ01");
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new OrganizationRepository(client);
      expect(await repo.findBranchByCode("org-1", "HQ01")).toBeNull();
    });

    it("returns null when no data", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const repo = new OrganizationRepository(client);
      expect(await repo.findBranchByCode("org-1", "HQ01")).toBeNull();
    });
  });

  describe("createBranch", () => {
    it("uppercases the code and maps the created branch", async () => {
      const row = buildDbBranch();
      const { client, builders } = createMockClient([
        { data: row, error: null },
      ]);
      const repo = new OrganizationRepository(client);

      const branch = await repo.createBranch({
        organizationId: "org-1",
        name: "HQ",
        code: "  hq01  ",
        createdBy: "user-1",
      });

      expect(branch?.id).toBe("branch-1");
      const insertArg = builders[0].insert.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(insertArg.organization_id).toBe("org-1");
      expect(insertArg.code).toBe("HQ01");
      expect(insertArg.is_headquarters).toBe(false);
      expect(insertArg.phone).toBeNull();
      expect(insertArg.created_by).toBe("user-1");
    });

    it("passes through provided optional fields", async () => {
      const row = buildDbBranch();
      const { client, builders } = createMockClient([
        { data: row, error: null },
      ]);
      const repo = new OrganizationRepository(client);

      await repo.createBranch({
        organizationId: "org-1",
        name: "HQ",
        code: "HQ01",
        isHeadquarters: true,
        phone: "+910000000000",
        gstNumber: "GST1",
        createdBy: "user-1",
      });

      const insertArg = builders[0].insert.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(insertArg.is_headquarters).toBe(true);
      expect(insertArg.phone).toBe("+910000000000");
      expect(insertArg.gst_number).toBe("GST1");
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "dup" } },
      ]);
      const repo = new OrganizationRepository(client);
      expect(
        await repo.createBranch({
          organizationId: "org-1",
          name: "HQ",
          code: "HQ01",
          createdBy: "user-1",
        })
      ).toBeNull();
    });

    it("returns null when no data", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const repo = new OrganizationRepository(client);
      expect(
        await repo.createBranch({
          organizationId: "org-1",
          name: "HQ",
          code: "HQ01",
          createdBy: "user-1",
        })
      ).toBeNull();
    });
  });

  describe("updateBranch", () => {
    it("applies the patch, sets updated_by/updated_at, and maps the result", async () => {
      const row = buildDbBranch({ name: "Renamed" });
      const { client, builders } = createMockClient([
        { data: row, error: null },
      ]);
      const repo = new OrganizationRepository(client);

      const branch = await repo.updateBranch(
        "branch-1",
        { name: "Renamed" },
        "user-9"
      );

      expect(branch?.name).toBe("Renamed");
      const patchArg = builders[0].update.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(patchArg.name).toBe("Renamed");
      expect(patchArg.updated_by).toBe("user-9");
      expect(typeof patchArg.updated_at).toBe("string");
      expect(builders[0].eq).toHaveBeenCalledWith("id", "branch-1");
      expect(builders[0].is).toHaveBeenCalledWith("deleted_at", null);
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new OrganizationRepository(client);
      expect(
        await repo.updateBranch("branch-1", { name: "x" }, "user-9")
      ).toBeNull();
    });

    it("returns null when no data", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const repo = new OrganizationRepository(client);
      expect(
        await repo.updateBranch("branch-1", { name: "x" }, "user-9")
      ).toBeNull();
    });
  });

  describe("softDeleteBranch", () => {
    it("returns true when the update succeeds", async () => {
      const { client, builders } = createMockClient([
        { data: null, error: null },
      ]);
      const repo = new OrganizationRepository(client);

      const result = await repo.softDeleteBranch("branch-1", "user-9");
      expect(result).toBe(true);
      const patchArg = builders[0].update.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(typeof patchArg.deleted_at).toBe("string");
      expect(patchArg.deleted_by).toBe("user-9");
      expect(builders[0].eq).toHaveBeenCalledWith("id", "branch-1");
      expect(builders[0].is).toHaveBeenCalledWith("deleted_at", null);
    });

    it("returns false when the update errors", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "boom" } },
      ]);
      const repo = new OrganizationRepository(client);
      expect(await repo.softDeleteBranch("branch-1", "user-9")).toBe(false);
    });
  });

  // ── Members ───────────────────────────────────────────────

  describe("createMember", () => {
    it("inserts an active member with joined_at and maps the result", async () => {
      const row = buildDbMember();
      const { client, builders } = createMockClient([
        { data: row, error: null },
      ]);
      const repo = new OrganizationRepository(client);

      const member = await repo.createMember({
        organizationId: "org-1",
        userId: "user-1",
        roleId: "role-1",
        createdBy: "user-1",
      });

      expect(member?.id).toBe("member-1");
      const insertArg = builders[0].insert.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(insertArg.organization_id).toBe("org-1");
      expect(insertArg.user_id).toBe("user-1");
      expect(insertArg.role_id).toBe("role-1");
      expect(insertArg.status).toBe("active");
      expect(insertArg.branch_id).toBeNull();
      expect(insertArg.invited_by).toBeNull();
      expect(typeof insertArg.joined_at).toBe("string");
    });

    it("passes through branchId and invitedBy", async () => {
      const row = buildDbMember();
      const { client, builders } = createMockClient([
        { data: row, error: null },
      ]);
      const repo = new OrganizationRepository(client);

      await repo.createMember({
        organizationId: "org-1",
        userId: "user-1",
        roleId: "role-1",
        branchId: "branch-9",
        invitedBy: "user-2",
        createdBy: "user-1",
      });

      const insertArg = builders[0].insert.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(insertArg.branch_id).toBe("branch-9");
      expect(insertArg.invited_by).toBe("user-2");
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "dup" } },
      ]);
      const repo = new OrganizationRepository(client);
      expect(
        await repo.createMember({
          organizationId: "org-1",
          userId: "user-1",
          roleId: "role-1",
          createdBy: "user-1",
        })
      ).toBeNull();
    });

    it("returns null when no data", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const repo = new OrganizationRepository(client);
      expect(
        await repo.createMember({
          organizationId: "org-1",
          userId: "user-1",
          roleId: "role-1",
          createdBy: "user-1",
        })
      ).toBeNull();
    });
  });

  describe("findMembersWithUser", () => {
    it("joins user and role data and maps each member", async () => {
      const row = {
        ...buildDbMember(),
        users: {
          email: "u@acme.test",
          full_name: "User One",
          avatar_url: "https://acme.test/a.png",
        },
        roles: { name: "Admin" },
      };
      const { client, builders } = createMockClient([
        { data: [row], error: null },
      ]);
      const repo = new OrganizationRepository(client);

      const members = await repo.findMembersWithUser("org-1");
      expect(members).toHaveLength(1);
      expect(members[0].id).toBe("member-1");
      expect(members[0].email).toBe("u@acme.test");
      expect(members[0].fullName).toBe("User One");
      expect(members[0].avatarUrl).toBe("https://acme.test/a.png");
      expect(members[0].roleName).toBe("Admin");
      expect(builders[0].eq).toHaveBeenCalledWith("organization_id", "org-1");
    });

    it("maps null user/role joins to null fields", async () => {
      const row = {
        ...buildDbMember(),
        users: null,
        roles: null,
      };
      const { client } = createMockClient([{ data: [row], error: null }]);
      const repo = new OrganizationRepository(client);

      const members = await repo.findMembersWithUser("org-1");
      expect(members[0].email).toBeNull();
      expect(members[0].fullName).toBeNull();
      expect(members[0].avatarUrl).toBeNull();
      expect(members[0].roleName).toBeNull();
    });

    it("returns [] on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new OrganizationRepository(client);
      expect(await repo.findMembersWithUser("org-1")).toEqual([]);
    });

    it("returns [] when no data", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const repo = new OrganizationRepository(client);
      expect(await repo.findMembersWithUser("org-1")).toEqual([]);
    });
  });

  describe("findMember", () => {
    it("maps a member with date conversions", async () => {
      const row = buildDbMember();
      const { client, builders } = createMockClient([
        { data: row, error: null },
      ]);
      const repo = new OrganizationRepository(client);

      const member = await repo.findMember("org-1", "user-1");

      expect(member?.userId).toBe("user-1");
      expect(member?.roleId).toBe("role-1");
      expect(member?.branchId).toBe("branch-1");
      expect(member?.invitedAt).toEqual(new Date("2026-01-01T00:00:00.000Z"));
      expect(member?.joinedAt).toEqual(new Date("2026-01-03T00:00:00.000Z"));
      expect(builders[0].eq).toHaveBeenCalledWith("status", "active");
    });

    it("maps null invitedAt/joinedAt when absent", async () => {
      const row = buildDbMember({ invited_at: null, joined_at: null });
      const { client } = createMockClient([{ data: row, error: null }]);
      const repo = new OrganizationRepository(client);

      const member = await repo.findMember("org-1", "user-1");
      expect(member?.invitedAt).toBeNull();
      expect(member?.joinedAt).toBeNull();
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new OrganizationRepository(client);
      expect(await repo.findMember("org-1", "user-1")).toBeNull();
    });

    it("returns null when no data", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const repo = new OrganizationRepository(client);
      expect(await repo.findMember("org-1", "user-1")).toBeNull();
    });
  });

  describe("findMembersByOrg", () => {
    it("maps a list of members", async () => {
      const m1 = buildDbMember({ id: "member-1" });
      const m2 = buildDbMember({ id: "member-2" });
      const { client } = createMockClient([
        { data: [m1, m2], error: null },
      ]);
      const repo = new OrganizationRepository(client);

      const members = await repo.findMembersByOrg("org-1");
      expect(members.map((m) => m.id)).toEqual(["member-1", "member-2"]);
    });

    it("returns [] on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new OrganizationRepository(client);
      expect(await repo.findMembersByOrg("org-1")).toEqual([]);
    });

    it("returns [] when no data", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const repo = new OrganizationRepository(client);
      expect(await repo.findMembersByOrg("org-1")).toEqual([]);
    });
  });

  // ── Roles & Permissions ───────────────────────────────────

  describe("findRolesForOrg", () => {
    it("maps roles and their non-null permissions", async () => {
      const role = {
        ...buildDbRole(),
        role_permissions: [
          { permissions: buildDbPermission({ id: "perm-1" }) },
          { permissions: null },
          {
            permissions: buildDbPermission({
              id: "perm-2",
              name: "invoice.read",
              action: "read",
            }),
          },
        ],
      };
      const { client, builders } = createMockClient([
        { data: [role], error: null },
      ]);
      const repo = new OrganizationRepository(client);

      const roles = await repo.findRolesForOrg("org-1");

      expect(roles).toHaveLength(1);
      expect(roles[0].name).toBe("Admin");
      expect(roles[0].isSystem).toBe(false);
      expect(roles[0].createdAt).toBeInstanceOf(Date);
      // null permission is filtered out, two remain.
      expect(roles[0].permissions.map((p) => p.id)).toEqual([
        "perm-1",
        "perm-2",
      ]);
      expect(roles[0].permissions[0]).toEqual({
        id: "perm-1",
        module: "invoice",
        action: "create",
        name: "invoice.create",
        description: "Create invoices",
      });
      expect(builders[0].or).toHaveBeenCalledWith(
        "organization_id.eq.org-1,is_system.eq.true"
      );
    });

    it("returns [] on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new OrganizationRepository(client);
      expect(await repo.findRolesForOrg("org-1")).toEqual([]);
    });

    it("returns [] when no data", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const repo = new OrganizationRepository(client);
      expect(await repo.findRolesForOrg("org-1")).toEqual([]);
    });
  });

  describe("findRoleById", () => {
    it("maps a single role with permissions", async () => {
      const role = {
        ...buildDbRole(),
        role_permissions: [
          { permissions: buildDbPermission() },
          { permissions: null },
        ],
      };
      const { client } = createMockClient([{ data: role, error: null }]);
      const repo = new OrganizationRepository(client);

      const result = await repo.findRoleById("role-1");
      expect(result?.id).toBe("role-1");
      expect(result?.permissions).toHaveLength(1);
      expect(result?.permissions[0].name).toBe("invoice.create");
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new OrganizationRepository(client);
      expect(await repo.findRoleById("role-1")).toBeNull();
    });

    it("returns null when no data", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const repo = new OrganizationRepository(client);
      expect(await repo.findRoleById("role-1")).toBeNull();
    });
  });

  describe("findUserPermissions", () => {
    it("returns the flattened list of permission names", async () => {
      const data = {
        roles: {
          role_permissions: [
            { permissions: { name: "invoice.create" } },
            { permissions: { name: "invoice.read" } },
            { permissions: null },
          ],
        },
      };
      const { client, builders } = createMockClient([
        { data, error: null },
      ]);
      const repo = new OrganizationRepository(client);

      const perms = await repo.findUserPermissions("org-1", "user-1");
      expect(perms).toEqual(["invoice.create", "invoice.read"]);
      expect(builders[0].eq).toHaveBeenCalledWith("status", "active");
    });

    it("returns [] when the member has no role", async () => {
      const { client } = createMockClient([
        { data: { roles: null }, error: null },
      ]);
      const repo = new OrganizationRepository(client);
      expect(await repo.findUserPermissions("org-1", "user-1")).toEqual([]);
    });

    it("returns [] on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new OrganizationRepository(client);
      expect(await repo.findUserPermissions("org-1", "user-1")).toEqual([]);
    });

    it("returns [] when no data", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const repo = new OrganizationRepository(client);
      expect(await repo.findUserPermissions("org-1", "user-1")).toEqual([]);
    });
  });

  // ── Invitations ───────────────────────────────────────────

  describe("findInvitationByToken", () => {
    it("maps an invitation including date conversions", async () => {
      const row = buildDbInvitation();
      const { client, builders } = createMockClient([
        { data: row, error: null },
      ]);
      const repo = new OrganizationRepository(client);

      const inv = await repo.findInvitationByToken("tok-123");
      expect(inv?.token).toBe("tok-123");
      expect(inv?.expiresAt).toEqual(new Date("2026-02-01T00:00:00.000Z"));
      expect(inv?.acceptedAt).toEqual(new Date("2026-01-10T00:00:00.000Z"));
      expect(inv?.createdBy).toBe("user-1");
      expect(builders[0].eq).toHaveBeenCalledWith("token", "tok-123");
    });

    it("maps null acceptedAt when not accepted", async () => {
      const row = buildDbInvitation({ accepted_at: null });
      const { client } = createMockClient([{ data: row, error: null }]);
      const repo = new OrganizationRepository(client);

      const inv = await repo.findInvitationByToken("tok-123");
      expect(inv?.acceptedAt).toBeNull();
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new OrganizationRepository(client);
      expect(await repo.findInvitationByToken("tok")).toBeNull();
    });

    it("returns null when no data", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const repo = new OrganizationRepository(client);
      expect(await repo.findInvitationByToken("tok")).toBeNull();
    });
  });

  describe("findPendingInvitationsByOrg", () => {
    it("maps a list of pending invitations", async () => {
      const i1 = buildDbInvitation({ id: "inv-1" });
      const i2 = buildDbInvitation({ id: "inv-2" });
      const { client, builders } = createMockClient([
        { data: [i1, i2], error: null },
      ]);
      const repo = new OrganizationRepository(client);

      const invites = await repo.findPendingInvitationsByOrg("org-1");
      expect(invites.map((i) => i.id)).toEqual(["inv-1", "inv-2"]);
      expect(builders[0].eq).toHaveBeenCalledWith("status", "pending");
    });

    it("returns [] on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new OrganizationRepository(client);
      expect(await repo.findPendingInvitationsByOrg("org-1")).toEqual([]);
    });

    it("returns [] when no data", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const repo = new OrganizationRepository(client);
      expect(await repo.findPendingInvitationsByOrg("org-1")).toEqual([]);
    });
  });

  describe("createInvitation", () => {
    it("lowercases the email and maps the created invitation", async () => {
      const row = buildDbInvitation();
      const { client, builders } = createMockClient([
        { data: row, error: null },
      ]);
      const repo = new OrganizationRepository(client);

      const inv = await repo.createInvitation({
        organizationId: "org-1",
        email: "  Invitee@Acme.test  ",
        roleId: "role-1",
        createdBy: "user-1",
      });

      expect(inv?.id).toBe("inv-1");
      const insertArg = builders[0].insert.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(insertArg.email).toBe("invitee@acme.test");
      expect(insertArg.full_name).toBeNull();
      expect(insertArg.branch_id).toBeNull();
      expect(insertArg.role_id).toBe("role-1");
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new OrganizationRepository(client);
      expect(
        await repo.createInvitation({
          organizationId: "org-1",
          email: "a@b.com",
          roleId: "role-1",
          createdBy: "user-1",
        })
      ).toBeNull();
    });

    it("returns null when no data", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const repo = new OrganizationRepository(client);
      expect(
        await repo.createInvitation({
          organizationId: "org-1",
          email: "a@b.com",
          roleId: "role-1",
          createdBy: "user-1",
        })
      ).toBeNull();
    });
  });

  describe("updateInvitationStatus", () => {
    it("updates status with extra patch and maps the result", async () => {
      const row = buildDbInvitation({ status: "accepted" });
      const { client, builders } = createMockClient([
        { data: row, error: null },
      ]);
      const repo = new OrganizationRepository(client);

      const inv = await repo.updateInvitationStatus("inv-1", "accepted", {
        accepted_by: "user-9",
      });

      expect(inv?.status).toBe("accepted");
      const patchArg = builders[0].update.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(patchArg.status).toBe("accepted");
      expect(patchArg.accepted_by).toBe("user-9");
      expect(typeof patchArg.updated_at).toBe("string");
    });

    it("works with the default empty patch", async () => {
      const row = buildDbInvitation({ status: "cancelled" });
      const { client, builders } = createMockClient([
        { data: row, error: null },
      ]);
      const repo = new OrganizationRepository(client);

      const inv = await repo.updateInvitationStatus("inv-1", "cancelled");
      expect(inv?.status).toBe("cancelled");
      const patchArg = builders[0].update.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(patchArg.status).toBe("cancelled");
    });

    it("returns null on error", async () => {
      const { client } = createMockClient([
        { data: null, error: { message: "x" } },
      ]);
      const repo = new OrganizationRepository(client);
      expect(
        await repo.updateInvitationStatus("inv-1", "accepted")
      ).toBeNull();
    });

    it("returns null when no data", async () => {
      const { client } = createMockClient([{ data: null, error: null }]);
      const repo = new OrganizationRepository(client);
      expect(
        await repo.updateInvitationStatus("inv-1", "accepted")
      ).toBeNull();
    });
  });
});
