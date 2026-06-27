import { describe, expect, it } from "vitest";
import { render, screen } from "@/tests/utils";
import type { Organization } from "@/features/organization/types/organization.types";
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

function renderDashboard(org: Organization = makeOrg()) {
  return render(
    <DashboardView organization={org} organizations={[org]} userId="user-1" />
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

  it("renders the get-started setup banner with a link to settings", () => {
    renderDashboard();

    expect(
      screen.getByText(/get started with syncrate/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /complete setup/i })
    ).toHaveAttribute("href", "/settings");
  });

  it("renders all four stat cards", () => {
    renderDashboard();

    expect(screen.getByText("Total Revenue")).toBeInTheDocument();
    expect(screen.getByText("Active Customers")).toBeInTheDocument();
    expect(screen.getByText("Open Invoices")).toBeInTheDocument();
    expect(screen.getByText("Payments Received")).toBeInTheDocument();
    // All stat cards start with no data.
    expect(screen.getAllByText("No data yet")).toHaveLength(4);
  });

  it("renders the recent activity section with its empty state", () => {
    renderDashboard();

    expect(
      screen.getByRole("heading", { name: /recent activity/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/no activity yet/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view all/i })).toHaveAttribute(
      "href",
      "/reports"
    );
  });

  it("renders all quick actions with their destinations", () => {
    renderDashboard();

    expect(
      screen.getByRole("heading", { name: /quick actions/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /new invoice/i })
    ).toHaveAttribute("href", "/invoices/new");
    expect(
      screen.getByRole("link", { name: /add customer/i })
    ).toHaveAttribute("href", "/customers/new");
    expect(
      screen.getByRole("link", { name: /record payment/i })
    ).toHaveAttribute("href", "/payments/new");
    expect(
      screen.getByRole("link", { name: /add product/i })
    ).toHaveAttribute("href", "/products/new");
  });
});
