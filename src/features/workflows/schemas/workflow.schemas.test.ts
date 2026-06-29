import { describe, it, expect } from "vitest";
import {
  stepSchema,
  stepsSchema,
  definitionSchema,
  parseStepsJson,
  createWorkflowSchema,
  updateWorkflowSchema,
} from "./workflow.schemas";

describe("stepSchema (discriminated union on type)", () => {
  it("accepts a log step and defaults its config", () => {
    const parsed = stepSchema.parse({ id: "s1", name: "Log", type: "log" });
    expect(parsed.type).toBe("log");
    expect(parsed.config).toEqual({});
  });

  it("accepts a noop step with a message", () => {
    const parsed = stepSchema.parse({
      id: "s1",
      name: "Noop",
      type: "noop",
      config: { message: "hi" },
    });
    expect(parsed.type === "noop" && parsed.config.message).toBe("hi");
  });

  it("requires eventType for a webhook step", () => {
    const ok = stepSchema.safeParse({
      id: "s1",
      name: "Hook",
      type: "webhook",
      config: { eventType: "invoice.paid" },
    });
    expect(ok.success).toBe(true);

    const bad = stepSchema.safeParse({
      id: "s1",
      name: "Hook",
      type: "webhook",
      config: {},
    });
    expect(bad.success).toBe(false);
  });

  it("requires entityType for an approval step and allows extra config", () => {
    const parsed = stepSchema.parse({
      id: "s1",
      name: "Approve",
      type: "approval",
      config: { entityType: "purchase_invoice", threshold: 1000 },
    });
    expect(parsed.type === "approval" && parsed.config.entityType).toBe(
      "purchase_invoice"
    );
    expect(parsed.type === "approval" && parsed.config.threshold).toBe(1000);
  });

  it("rejects an unknown step type", () => {
    const bad = stepSchema.safeParse({
      id: "s1",
      name: "X",
      type: "send_email",
      config: {},
    });
    expect(bad.success).toBe(false);
  });

  it("rejects a step missing id or name", () => {
    expect(
      stepSchema.safeParse({ name: "X", type: "log" }).success
    ).toBe(false);
    expect(
      stepSchema.safeParse({ id: "s1", type: "log" }).success
    ).toBe(false);
  });
});

describe("definitionSchema / stepsSchema", () => {
  it("defaults steps to an empty array", () => {
    expect(definitionSchema.parse({})).toEqual({ steps: [] });
  });

  it("validates an ordered list of mixed steps", () => {
    const parsed = stepsSchema.parse([
      { id: "s1", name: "Log", type: "log" },
      { id: "s2", name: "Hook", type: "webhook", config: { eventType: "x" } },
    ]);
    expect(parsed).toHaveLength(2);
  });

  it("rejects more than 50 steps", () => {
    const many = Array.from({ length: 51 }, (_, i) => ({
      id: `s${i}`,
      name: `Step ${i}`,
      type: "log" as const,
    }));
    expect(stepsSchema.safeParse(many).success).toBe(false);
  });
});

describe("parseStepsJson", () => {
  it("parses a JSON array string", () => {
    const result = parseStepsJson(
      JSON.stringify([{ id: "s1", name: "Log", type: "log" }])
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
    }
  });

  it("treats an empty string as no steps", () => {
    const result = parseStepsJson("");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([]);
    }
  });

  it("fails on malformed JSON", () => {
    const result = parseStepsJson("{not json");
    expect(result.success).toBe(false);
  });

  it("fails on a structurally invalid step", () => {
    const result = parseStepsJson(
      JSON.stringify([{ id: "s1", name: "Hook", type: "webhook", config: {} }])
    );
    expect(result.success).toBe(false);
  });

  it("accepts an already-parsed array", () => {
    const result = parseStepsJson([{ id: "s1", name: "Log", type: "log" }]);
    expect(result.success).toBe(true);
  });
});

describe("createWorkflowSchema / updateWorkflowSchema", () => {
  it("accepts a valid create payload", () => {
    const parsed = createWorkflowSchema.safeParse({
      name: "My flow",
      triggerEvent: "invoice.created",
      steps: [{ id: "s1", name: "Log", type: "log" }],
      isActive: true,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a too-short name", () => {
    const parsed = createWorkflowSchema.safeParse({
      name: "x",
      triggerEvent: "invoice.created",
      steps: [],
    });
    expect(parsed.success).toBe(false);
  });

  it("coerces version on update", () => {
    const parsed = updateWorkflowSchema.safeParse({
      name: "Renamed",
      triggerEvent: "invoice.created",
      steps: [],
      version: "3",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.version).toBe(3);
    }
  });
});
