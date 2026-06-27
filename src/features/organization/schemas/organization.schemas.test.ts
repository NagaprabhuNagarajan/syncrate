import { describe, expect, it } from "vitest";
import {
  createOrganizationSchema,
  updateOrganizationSchema,
  inviteUserSchema,
  createBranchSchema,
  updateBranchSchema,
} from "./organization.schemas";

const VALID_GST = "22AAAAA0000A1Z5";
const VALID_PAN = "AAAAA0000A";
const VALID_CIN = "U12345MH2020PTC123456";
const UUID = "00000000-0000-0000-0000-000000000000";

// ─────────────────────────────────────────────────────────────
// createOrganizationSchema
// ─────────────────────────────────────────────────────────────

describe("createOrganizationSchema", () => {
  it("accepts the minimal valid payload (name only)", () => {
    const result = createOrganizationSchema.safeParse({ name: "Acme Co" });
    expect(result.success).toBe(true);
  });

  it("trims the organization name", () => {
    const result = createOrganizationSchema.safeParse({ name: "  Acme Co  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Acme Co");
    }
  });

  it("rejects a name shorter than 2 characters", () => {
    expect(createOrganizationSchema.safeParse({ name: "A" }).success).toBe(
      false
    );
  });

  it("rejects a name longer than 150 characters", () => {
    const result = createOrganizationSchema.safeParse({
      name: "x".repeat(151),
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid business type", () => {
    const result = createOrganizationSchema.safeParse({
      name: "Acme",
      businessType: "private_limited",
    });
    expect(result.success).toBe(true);
  });

  it("accepts an empty string for businessType (the HTML select default — field is optional)", () => {
    // The <select> emits "" when no option is chosen. z.enum().optional() would
    // reject this, so the schema adds .or(z.literal("")) to allow the empty string.
    const result = createOrganizationSchema.safeParse({
      name: "Acme",
      businessType: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown business type", () => {
    const result = createOrganizationSchema.safeParse({
      name: "Acme",
      businessType: "co_op",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid GST number", () => {
    const result = createOrganizationSchema.safeParse({
      name: "Acme",
      gstNumber: VALID_GST,
    });
    expect(result.success).toBe(true);
  });

  it("accepts an empty string for GST (treated as not provided)", () => {
    const result = createOrganizationSchema.safeParse({
      name: "Acme",
      gstNumber: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a malformed GST number", () => {
    const result = createOrganizationSchema.safeParse({
      name: "Acme",
      gstNumber: "INVALID123",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a 6-digit pincode and rejects others", () => {
    expect(
      createOrganizationSchema.safeParse({ name: "Acme", pincode: "560001" })
        .success
    ).toBe(true);
    expect(
      createOrganizationSchema.safeParse({ name: "Acme", pincode: "5600" })
        .success
    ).toBe(false);
  });

  it("requires country to be a 2-letter ISO code", () => {
    expect(
      createOrganizationSchema.safeParse({ name: "Acme", country: "IN" }).success
    ).toBe(true);
    expect(
      createOrganizationSchema.safeParse({ name: "Acme", country: "IND" })
        .success
    ).toBe(false);
  });

  it("normalizes optional email to lowercase", () => {
    const result = createOrganizationSchema.safeParse({
      name: "Acme",
      email: "INFO@Acme.COM",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("info@acme.com");
    }
  });

  it("rejects an invalid phone number", () => {
    const result = createOrganizationSchema.safeParse({
      name: "Acme",
      phone: "abc",
    });
    expect(result.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// updateOrganizationSchema
// ─────────────────────────────────────────────────────────────

describe("updateOrganizationSchema", () => {
  it("accepts an empty patch (all fields optional)", () => {
    expect(updateOrganizationSchema.safeParse({}).success).toBe(true);
  });

  it("accepts a valid PAN number", () => {
    const result = updateOrganizationSchema.safeParse({ panNumber: VALID_PAN });
    expect(result.success).toBe(true);
  });

  it("rejects a malformed PAN number", () => {
    expect(
      updateOrganizationSchema.safeParse({ panNumber: "BADPAN" }).success
    ).toBe(false);
  });

  it("accepts a valid CIN number", () => {
    const result = updateOrganizationSchema.safeParse({ cinNumber: VALID_CIN });
    expect(result.success).toBe(true);
  });

  it("rejects a malformed CIN number", () => {
    expect(
      updateOrganizationSchema.safeParse({ cinNumber: "12345" }).success
    ).toBe(false);
  });

  it("accepts a valid website URL and rejects a malformed one", () => {
    expect(
      updateOrganizationSchema.safeParse({ website: "https://acme.com" }).success
    ).toBe(true);
    expect(
      updateOrganizationSchema.safeParse({ website: "acme" }).success
    ).toBe(false);
  });

  it("allows clearing website with an empty string", () => {
    expect(updateOrganizationSchema.safeParse({ website: "" }).success).toBe(
      true
    );
  });
});

// ─────────────────────────────────────────────────────────────
// inviteUserSchema
// ─────────────────────────────────────────────────────────────

describe("inviteUserSchema", () => {
  it("accepts a valid invitation", () => {
    const result = inviteUserSchema.safeParse({
      email: "new@example.com",
      roleId: UUID,
    });
    expect(result.success).toBe(true);
  });

  it("normalizes the email to lowercase", () => {
    const result = inviteUserSchema.safeParse({
      email: "New@Example.com",
      roleId: UUID,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("new@example.com");
    }
  });

  it("rejects a missing email", () => {
    expect(inviteUserSchema.safeParse({ roleId: UUID }).success).toBe(false);
  });

  it("rejects a non-uuid roleId", () => {
    const result = inviteUserSchema.safeParse({
      email: "new@example.com",
      roleId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("accepts an optional valid branchId and rejects a non-uuid one", () => {
    expect(
      inviteUserSchema.safeParse({
        email: "new@example.com",
        roleId: UUID,
        branchId: UUID,
      }).success
    ).toBe(true);
    expect(
      inviteUserSchema.safeParse({
        email: "new@example.com",
        roleId: UUID,
        branchId: "bad",
      }).success
    ).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// createBranchSchema
// ─────────────────────────────────────────────────────────────

describe("createBranchSchema", () => {
  it("accepts a minimal valid branch", () => {
    const result = createBranchSchema.safeParse({
      name: "Main Branch",
      code: "MB01",
    });
    expect(result.success).toBe(true);
  });

  it("uppercases the code (lowercase input is accepted and normalized)", () => {
    const result = createBranchSchema.safeParse({
      name: "Main Branch",
      code: "mb01",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.code).toBe("MB01");
    }
  });

  it("rejects a code shorter than 2 characters", () => {
    expect(
      createBranchSchema.safeParse({ name: "Main Branch", code: "M" }).success
    ).toBe(false);
  });

  it("rejects a code longer than 10 characters", () => {
    expect(
      createBranchSchema.safeParse({ name: "Main Branch", code: "ABCDEFGHIJK" })
        .success
    ).toBe(false);
  });

  it("rejects a code with invalid characters", () => {
    expect(
      createBranchSchema.safeParse({ name: "Main Branch", code: "MB-1!" })
        .success
    ).toBe(false);
  });

  it("requires the branch name", () => {
    expect(createBranchSchema.safeParse({ code: "MB01" }).success).toBe(false);
  });

  it("rejects a name shorter than 2 characters", () => {
    expect(
      createBranchSchema.safeParse({ name: "M", code: "MB01" }).success
    ).toBe(false);
  });

  it("allows optional contact fields to be empty strings", () => {
    const result = createBranchSchema.safeParse({
      name: "Main Branch",
      code: "MB01",
      phone: "",
      email: "",
      pincode: "",
      gstNumber: "",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid GST number and a valid pincode", () => {
    const result = createBranchSchema.safeParse({
      name: "Main Branch",
      code: "MB01",
      gstNumber: VALID_GST,
      pincode: "560001",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a malformed pincode", () => {
    expect(
      createBranchSchema.safeParse({
        name: "Main Branch",
        code: "MB01",
        pincode: "12",
      }).success
    ).toBe(false);
  });

  it("accepts the optional isHeadquarters flag", () => {
    const result = createBranchSchema.safeParse({
      name: "Main Branch",
      code: "MB01",
      isHeadquarters: true,
    });
    expect(result.success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// updateBranchSchema
// ─────────────────────────────────────────────────────────────

describe("updateBranchSchema", () => {
  it("accepts an empty patch (all fields optional)", () => {
    expect(updateBranchSchema.safeParse({}).success).toBe(true);
  });

  it("uppercases the code when provided", () => {
    const result = updateBranchSchema.safeParse({ code: "br99" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.code).toBe("BR99");
    }
  });

  it("rejects an invalid code", () => {
    expect(updateBranchSchema.safeParse({ code: "x" }).success).toBe(false);
  });

  it("rejects a name shorter than 2 characters", () => {
    expect(updateBranchSchema.safeParse({ name: "A" }).success).toBe(false);
  });

  it("accepts a valid status enum value", () => {
    expect(updateBranchSchema.safeParse({ status: "inactive" }).success).toBe(
      true
    );
    expect(updateBranchSchema.safeParse({ status: "closed" }).success).toBe(
      true
    );
  });

  it("rejects an unknown status value", () => {
    expect(updateBranchSchema.safeParse({ status: "archived" }).success).toBe(
      false
    );
  });

  it("allows optional fields to be empty strings", () => {
    const result = updateBranchSchema.safeParse({
      phone: "",
      email: "",
      pincode: "",
      gstNumber: "",
    });
    expect(result.success).toBe(true);
  });
});
