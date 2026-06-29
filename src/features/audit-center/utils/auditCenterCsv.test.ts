import { describe, it, expect } from "vitest";
import type { AuditCenterEntry } from "@/features/audit-center/types/audit-center.types";
import { toAuditCenterCsv, AUDIT_CENTER_SOURCE_LABEL } from "./auditCenterCsv";

function buildEntry(overrides: Partial<AuditCenterEntry> = {}): AuditCenterEntry {
  return {
    id: "business:log-1",
    source: "business",
    action: "customer.create",
    actor: "user-1",
    summary: "Created customer",
    timestamp: "2026-01-02T10:00:00.000Z",
    status: null,
    details: { entityType: "customer" },
    ...overrides,
  };
}

describe("toAuditCenterCsv", () => {
  it("emits a header row with the expected columns", () => {
    const csv = toAuditCenterCsv([]);
    expect(csv).toBe("timestamp,source,action,actor,status,summary,details");
  });

  it("serializes an entry with a human-readable source label", () => {
    const csv = toAuditCenterCsv([buildEntry({ source: "ai" })]);
    const lines = csv.split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain(AUDIT_CENTER_SOURCE_LABEL.ai);
    expect(lines[1]).toContain("2026-01-02T10:00:00.000Z");
  });

  it("renders a null actor as System and a null status as empty", () => {
    const csv = toAuditCenterCsv([
      buildEntry({ actor: null, status: null, summary: "x", details: {} }),
    ]);
    const row = csv.split("\r\n")[1];
    // timestamp,source,action,actor,status,summary,details
    expect(row).toBe(
      '2026-01-02T10:00:00.000Z,Business,customer.create,System,,x,{}'
    );
  });

  it("quotes fields containing commas and quotes (RFC 4180)", () => {
    const csv = toAuditCenterCsv([
      buildEntry({ summary: 'Created "Acme, Inc."', details: { a: 1 } }),
    ]);
    const row = csv.split("\r\n")[1];
    expect(row).toContain('"Created ""Acme, Inc."""');
  });

  it("serializes the details blob as JSON", () => {
    const csv = toAuditCenterCsv([
      buildEntry({ details: { entityType: "customer", entityId: "c1" } }),
    ]);
    const row = csv.split("\r\n")[1];
    // JSON contains a comma → must be quoted with doubled inner quotes
    expect(row).toContain(
      '"{""entityType"":""customer"",""entityId"":""c1""}"'
    );
  });
});
