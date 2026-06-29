import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/tests/utils";
import type { Organization } from "@/features/organization/types/organization.types";
import { SelectOrganizationView } from "./select-organization-view";

// ─────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────

const { mockSwitchOrganization } = vi.hoisted(() => ({
  mockSwitchOrganization: vi.fn(),
}));

vi.mock("@/features/organization/actions/organization.actions", () => ({
  switchOrganizationAction: mockSwitchOrganization,
}));

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

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("SelectOrganizationView", () => {
  it("renders the heading and organization count", () => {
    const orgs = [
      makeOrg({ id: "org-1", name: "Acme Corp" }),
      makeOrg({ id: "org-2", name: "Beta LLP", plan: "starter" }),
    ];
    render(<SelectOrganizationView organizations={orgs} userId="user-1" />);

    expect(
      screen.getByRole("heading", { name: /select organization/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/you belong to 2 organizations/i)
    ).toBeInTheDocument();
  });

  it("renders a card for each organization with its plan label", () => {
    const orgs = [
      makeOrg({ id: "org-1", name: "Acme Corp", plan: "free" }),
      makeOrg({ id: "org-2", name: "Beta LLP", plan: "professional" }),
    ];
    render(<SelectOrganizationView organizations={orgs} userId="user-1" />);

    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("Beta LLP")).toBeInTheDocument();
    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(screen.getByText("Professional")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /select acme corp/i })
    ).toBeInTheDocument();
  });

  it("renders the empty state when no organizations are provided", () => {
    render(<SelectOrganizationView organizations={[]} userId="user-1" />);

    expect(
      screen.getByText(/you belong to 0 organizations/i)
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders city/state and GST details when present", () => {
    const orgs = [
      makeOrg({
        id: "org-1",
        name: "Acme Corp",
        city: "Mumbai",
        state: "Maharashtra",
        gstNumber: "27AAAAA0000A1Z5",
      }),
    ];
    render(<SelectOrganizationView organizations={orgs} userId="user-1" />);

    expect(screen.getByText("Mumbai, Maharashtra")).toBeInTheDocument();
    expect(screen.getByText(/GST: 27AAAAA0000A1Z5/i)).toBeInTheDocument();
  });

  it("renders the org logo image when a logoUrl is provided", () => {
    const orgs = [
      makeOrg({
        id: "org-1",
        name: "Acme Corp",
        logoUrl: "https://example.com/logo.png",
      }),
    ];
    render(<SelectOrganizationView organizations={orgs} userId="user-1" />);

    const img = screen.getByRole("img", { name: "Acme Corp" });
    expect(img).toHaveAttribute("src", "https://example.com/logo.png");
  });

  it("renders a placeholder icon (no org image) when there is no logo", () => {
    const orgs = [makeOrg({ id: "org-1", name: "Acme Corp", logoUrl: null })];
    render(<SelectOrganizationView organizations={orgs} userId="user-1" />);

    // The Syncrate brand logo is always present; the org itself must not
    // render an <img> (it falls back to a Building2 placeholder icon).
    expect(
      screen.queryByRole("img", { name: "Acme Corp" })
    ).not.toBeInTheDocument();
  });

  it("calls switchOrganizationAction with the org id when a card is clicked", async () => {
    mockSwitchOrganization.mockResolvedValue(undefined);
    const orgs = [makeOrg({ id: "org-42", name: "Acme Corp" })];
    const user = userEvent.setup();
    render(<SelectOrganizationView organizations={orgs} userId="user-1" />);

    await user.click(screen.getByRole("button", { name: /select acme corp/i }));

    await waitFor(() =>
      expect(mockSwitchOrganization).toHaveBeenCalledWith("org-42")
    );
  });

  it("exposes a link to create a new organization", () => {
    const orgs = [makeOrg()];
    render(<SelectOrganizationView organizations={orgs} userId="user-1" />);

    const link = screen.getByRole("link", {
      name: /create a new organization/i,
    });
    expect(link).toHaveAttribute("href", "/create-organization");
  });
});
