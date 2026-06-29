import { describe, it, expect } from "vitest";
import {
  conditionSchema,
  conditionFromFormSchema,
  createRuleSchema,
  updateRuleSchema,
  decisionSchema,
} from "./approval.schemas";

describe("conditionSchema", () => {
  it("accepts a numeric operator with a numeric value", () => {
    const result = conditionSchema.safeParse({
      field: "total",
      operator: "gte",
      value: 1000,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a numeric operator with a string value", () => {
    const result = conditionSchema.safeParse({
      field: "total",
      operator: "gt",
      value: "1000",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-finite numeric value", () => {
    const result = conditionSchema.safeParse({
      field: "total",
      operator: "lt",
      value: Number.POSITIVE_INFINITY,
    });
    expect(result.success).toBe(false);
  });

  it("accepts eq with a string value", () => {
    expect(
      conditionSchema.safeParse({
        field: "status",
        operator: "eq",
        value: "draft",
      }).success
    ).toBe(true);
  });

  it("accepts eq with a number value", () => {
    expect(
      conditionSchema.safeParse({ field: "qty", operator: "eq", value: 3 })
        .success
    ).toBe(true);
  });

  it("accepts eq with a boolean value", () => {
    expect(
      conditionSchema.safeParse({
        field: "flagged",
        operator: "eq",
        value: true,
      }).success
    ).toBe(true);
  });

  it("rejects an unknown operator", () => {
    expect(
      conditionSchema.safeParse({ field: "x", operator: "neq", value: 1 })
        .success
    ).toBe(false);
  });

  it("rejects an empty field", () => {
    expect(
      conditionSchema.safeParse({ field: "  ", operator: "gte", value: 1 })
        .success
    ).toBe(false);
  });
});

describe("conditionFromFormSchema", () => {
  it("coerces a numeric operator value to a number", () => {
    const result = conditionFromFormSchema.safeParse({
      field: "total",
      operator: "gte",
      value: "1500",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        field: "total",
        operator: "gte",
        value: 1500,
      });
    }
  });

  it("rejects a non-numeric value for a numeric operator", () => {
    expect(
      conditionFromFormSchema.safeParse({
        field: "total",
        operator: "gt",
        value: "abc",
      }).success
    ).toBe(false);
  });

  it("infers a boolean for eq", () => {
    const result = conditionFromFormSchema.safeParse({
      field: "flagged",
      operator: "eq",
      value: "true",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.value).toBe(true);
    }
  });

  it("infers a number for eq when the value is numeric", () => {
    const result = conditionFromFormSchema.safeParse({
      field: "qty",
      operator: "eq",
      value: "7",
    });
    expect(result.success && result.data.value).toBe(7);
  });

  it("falls back to a string for eq", () => {
    const result = conditionFromFormSchema.safeParse({
      field: "status",
      operator: "eq",
      value: "draft",
    });
    expect(result.success && result.data.value).toBe("draft");
  });

  it("rejects an empty value", () => {
    expect(
      conditionFromFormSchema.safeParse({
        field: "total",
        operator: "gte",
        value: "",
      }).success
    ).toBe(false);
  });
});

describe("createRuleSchema", () => {
  const valid = {
    name: "High value invoices",
    description: "Anything over 1 lakh",
    entityType: "purchase_invoice",
    condition: { field: "total", operator: "gte", value: 100000 },
    approverRoleId: "",
    isActive: true,
  };

  it("accepts a valid rule", () => {
    expect(createRuleSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a short name", () => {
    expect(
      createRuleSchema.safeParse({ ...valid, name: "x" }).success
    ).toBe(false);
  });

  it("rejects a missing entity type", () => {
    expect(
      createRuleSchema.safeParse({ ...valid, entityType: "" }).success
    ).toBe(false);
  });

  it("rejects an invalid approver role id", () => {
    expect(
      createRuleSchema.safeParse({ ...valid, approverRoleId: "not-a-uuid" })
        .success
    ).toBe(false);
  });

  it("rejects an invalid condition", () => {
    expect(
      createRuleSchema.safeParse({
        ...valid,
        condition: { field: "total", operator: "gte", value: "nope" },
      }).success
    ).toBe(false);
  });
});

describe("updateRuleSchema", () => {
  it("requires a version", () => {
    expect(updateRuleSchema.safeParse({ name: "Renamed" }).success).toBe(false);
  });

  it("accepts a partial update with a version", () => {
    expect(
      updateRuleSchema.safeParse({ name: "Renamed", version: 2 }).success
    ).toBe(true);
  });

  it("coerces a string version", () => {
    const result = updateRuleSchema.safeParse({ version: "3" });
    expect(result.success && result.data.version).toBe(3);
  });
});

describe("decisionSchema", () => {
  it("accepts an empty reason", () => {
    expect(decisionSchema.safeParse({ reason: "" }).success).toBe(true);
  });

  it("accepts an omitted reason", () => {
    expect(decisionSchema.safeParse({}).success).toBe(true);
  });

  it("rejects an overlong reason", () => {
    expect(
      decisionSchema.safeParse({ reason: "x".repeat(501) }).success
    ).toBe(false);
  });
});
