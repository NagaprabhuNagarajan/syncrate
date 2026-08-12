import { describe, it, expect } from "vitest";
import {
  requestConnectionSchema,
  updatePermissionsSchema,
} from "./connectionSchema";

const UUID = "11111111-1111-1111-1111-111111111111";
const UUID_2 = "22222222-2222-2222-2222-222222222222";

describe("requestConnectionSchema", () => {
  it("accepts a valid payload with a message", () => {
    const result = requestConnectionSchema.safeParse({
      requesterOrgId: UUID,
      recipientOrgId: UUID_2,
      counterpartyRole: "supplier",
      linkEntityId: UUID,
      message: "Hi, let's connect",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a payload without the optional message", () => {
    const result = requestConnectionSchema.safeParse({
      requesterOrgId: UUID,
      recipientOrgId: UUID_2,
      counterpartyRole: "supplier",
      linkEntityId: UUID,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.message).toBeUndefined();
    }
  });

  it("rejects a non-UUID requester org id", () => {
    const result = requestConnectionSchema.safeParse({
      requesterOrgId: "not-a-uuid",
      recipientOrgId: UUID_2,
      counterpartyRole: "supplier",
      linkEntityId: UUID,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-UUID recipient org id", () => {
    const result = requestConnectionSchema.safeParse({
      requesterOrgId: UUID,
      recipientOrgId: "nope",
      counterpartyRole: "supplier",
      linkEntityId: UUID,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a 500-character message but rejects 501", () => {
    expect(
      requestConnectionSchema.safeParse({
        requesterOrgId: UUID,
        recipientOrgId: UUID_2,
      counterpartyRole: "supplier",
      linkEntityId: UUID,
        message: "a".repeat(500),
      }).success
    ).toBe(true);
    expect(
      requestConnectionSchema.safeParse({
        requesterOrgId: UUID,
        recipientOrgId: UUID_2,
      counterpartyRole: "supplier",
      linkEntityId: UUID,
        message: "a".repeat(501),
      }).success
    ).toBe(false);
  });
});

describe("updatePermissionsSchema", () => {
  it("accepts valid permission grants", () => {
    const result = updatePermissionsSchema.safeParse({
      connectionId: UUID,
      myGrants: ["receive_invoices", "view_catalog"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts an empty grants array", () => {
    const result = updatePermissionsSchema.safeParse({
      connectionId: UUID,
      myGrants: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown permission", () => {
    const result = updatePermissionsSchema.safeParse({
      connectionId: UUID,
      myGrants: ["receive_invoices", "do_anything"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-UUID connection id", () => {
    const result = updatePermissionsSchema.safeParse({
      connectionId: "bad",
      myGrants: [],
    });
    expect(result.success).toBe(false);
  });
});
