import { describe, expect, it } from "vitest";
import { render, screen } from "@/tests/utils";
import type { Organization } from "@/features/organization/types/organization.types";
import type { DashboardKpis } from "@/features/dashboard/services/dashboard.service";
import type { DashboardAnalytics } from "@/features/dashboard/services/dashboard-analytics.service";
import { DashboardView } from "./dashboard-view";

// ─────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────

function makeOrg(overrides: Partial<Organization> = {}): Organization {
  return {
    id: "org-1",
    name: "Acme Corp",
    slug: "acme-corp",
    displayName: null,
    businessType: null,
    gstNumber: null,
    panNumber: null,
    cinNumber: null,
    phone: null,
    email: null,
    website: null,
    addressLine1: null,
    addressLine2: null,
    city: null,
    state: null,
    country: "IN",
    pincode: null,
    logoUrl: null,
    verificationStatus: "unverified",
    status: "active",
    plan: "free",
    planExpiresAt: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    createdBy: null,
    ...overrides,
  };
}

function makeKpis(overrides: Partial<DashboardKpis> = {}): DashboardKpis {
  return {
    salesThisMonth: 150000,
    salesLastMonth: 100000,
    purchasesThisMonth: 50000,
    outstandingReceivable: 25000,
    outstandingPayable: 10000,
    lowStockCount: 3,
    outOfStockCount: 1,
    openInvoiceCount: 5,
    recentActivity: [],
    ...overrides,
  };
}

function makeAnalytics(
  overrides: Partial<DashboardAnalytics> = {}
): DashboardAnalytics {
  return {
    trend: [
      { month: "Jan", sales: 100, purchases: 60 },
      { month: "Feb", sales: 120, purchases: 70 },
    ],
    aging: [
      { bucket: "0-30", receivable: 1000, payable: 500 },
      { bucket: "31-60", receivable: 0, payable: 0 },
      { bucket: "61-90", receivable: 0, payable: 0 },
      { bucket: "90+", receivable: 0, payable: 0 },
    ],
    invoiceStatus: [{ status: "paid", label: "Paid", count: 2, amount: 5000 }],
    topCustomers: [{ name: "Acme", amount: 5000 }],
    topProducts: [{ name: "Widget", amount: 3000 }],
    ...overrides,
  };
}

function renderDashboard(
  org: Organization = makeOrg(),
  kpis: DashboardKpis = makeKpis(),
  analytics: DashboardAnalytics = makeAnalytics()
) {
  return render(
    <DashboardView organization={org} kpis={kpis} analytics={analytics} />
  );
}

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("DashboardView", () => {
  it("renders the organization name as the page heading", () => {
    renderDashboard(makeOrg({ name: "Sharma Enterprises" }));

    expect(
      screen.getByRole("heading", { name: "Sharma Enterprises" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/here's your business overview/i)
    ).toBeInTheDocument();
  });

  it("renders all four KPI card labels", () => {
    renderDashboard();

    expect(screen.getByText("Sales This Month")).toBeInTheDocument();
    expect(screen.getByText("Outstanding Receivable")).toBeInTheDocument();
    expect(screen.getByText("Outstanding Payable")).toBeInTheDocument();
    expect(screen.getByText("Low Stock Items")).toBeInTheDocument();
  });

  it("shows open invoice count in the receivable badge when > 0", () => {
    renderDashboard(makeOrg(), makeKpis({ openInvoiceCount: 7 }));

    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText(/7 open invoice/i)).toBeInTheDocument();
  });

  it("renders the recent activity section with empty state when no activity", () => {
    renderDashboard(makeOrg(), makeKpis({ recentActivity: [] }));

    expect(
      screen.getByRole("heading", { name: /recent activity/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/no activity yet/i)).toBeInTheDocument();
  });

  it("renders activity rows when recent activity is provided", () => {
    const kpis = makeKpis({
      recentActivity: [
        {
          type: "invoice",
          id: "inv-1",
          reference: "INV-001",
          amount: 10000,
          date: "2024-06-01",
          partyName: "Test Customer",
        },
      ],
    });
    renderDashboard(makeOrg(), kpis);

    expect(screen.getByText("INV-001")).toBeInTheDocument();
    expect(screen.getByText("Test Customer")).toBeInTheDocument();
  });

  it("renders all quick actions with correct destinations", () => {
    renderDashboard();

    expect(
      screen.getByRole("heading", { name: /quick actions/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /new sales invoice/i })
    ).toHaveAttribute("href", "/invoices/new");
    expect(
      screen.getByRole("link", { name: /new purchase invoice/i })
    ).toHaveAttribute("href", "/bills/new");
    expect(
      screen.getByRole("link", { name: /view payments/i })
    ).toHaveAttribute("href", "/payments");
    expect(
      screen.getByRole("link", { name: /view inventory/i })
    ).toHaveAttribute("href", "/inventory");
  });

  it("shows positive growth indicator when sales increased", () => {
    renderDashboard(
      makeOrg(),
      makeKpis({ salesThisMonth: 200000, salesLastMonth: 100000 })
    );

    expect(screen.getByText(/\+100\.0%/)).toBeInTheDocument();
  });
});
