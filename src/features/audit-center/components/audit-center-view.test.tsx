import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@/tests/utils";
import type {
  AuditCenterEntry,
  AuditCenterPage,
} from "@/features/audit-center/types/audit-center.types";
import { AuditCenterView } from "./audit-center-view";

// ─────────────────────────────────────────────────────────────
// Mock the server actions the view calls on filter changes / export
// ─────────────────────────────────────────────────────────────

const { mockFetch, mockExport } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
  mockExport: vi.fn(),
}));

vi.mock("@/features/audit-center/actions/audit-center.actions", () => ({
  fetchAuditCenterAction: mockFetch,
  exportAuditCenterAction: mockExport,
}));

const ORG_ID = "org-1";

function buildEntry(overrides: Partial<AuditCenterEntry> = {}): AuditCenterEntry {
  return {
    id: "business:log-1",
    source: "business",
    action: "customer.create",
    actor: "user-1",
    summary: "Created customer Acme",
    timestamp: "2026-01-02T10:00:00.000Z",
    status: null,
    details: {},
    ...overrides,
  };
}

function buildPage(entries: AuditCenterEntry[]): AuditCenterPage {
  return { entries, total: entries.length, page: 1, pageSize: 25 };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AuditCenterView", () => {
  it("renders the header and aggregated rows from initial data", () => {
    render(
      <AuditCenterView
        organizationId={ORG_ID}
        initialData={buildPage([
          buildEntry(),
          buildEntry({
            id: "ai:ai-1",
            source: "ai",
            action: "assistant",
            summary: "Summarized invoices",
          }),
        ])}
      />
    );

    expect(
      screen.getByRole("heading", { name: /audit center/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Created customer Acme")).toBeInTheDocument();
    expect(screen.getByText("Summarized invoices")).toBeInTheDocument();
    // Raw action keys are humanized for display (customer.create -> Customer created).
    expect(screen.getByText("Customer created")).toBeInTheDocument();
  });

  it("renders the filter controls", () => {
    render(
      <AuditCenterView
        organizationId={ORG_ID}
        initialData={buildPage([buildEntry()])}
      />
    );

    expect(screen.getByLabelText("Source")).toBeInTheDocument();
    expect(screen.getByLabelText("Search")).toBeInTheDocument();
    expect(screen.getByLabelText("From")).toBeInTheDocument();
    expect(screen.getByLabelText("To")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /export csv/i })
    ).toBeInTheDocument();
  });

  it("shows the empty state when there are no entries", () => {
    render(
      <AuditCenterView
        organizationId={ORG_ID}
        initialData={buildPage([])}
      />
    );

    expect(screen.getByText("No audit entries")).toBeInTheDocument();
  });
});
