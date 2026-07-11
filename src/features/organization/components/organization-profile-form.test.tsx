import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/tests/utils";
import { OrganizationProfileForm } from "./organization-profile-form";
import type { Organization } from "@/features/organization/types/organization.types";

// ─────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────

const { mockUpdateOrganization, mockToastSuccess } = vi.hoisted(() => ({
  mockUpdateOrganization: vi.fn(),
  mockToastSuccess: vi.fn(),
}));

vi.mock("@/features/organization/actions/organization.actions", () => ({
  updateOrganizationAction: mockUpdateOrganization,
}));

vi.mock("sonner", () => ({
  toast: { success: mockToastSuccess },
}));

const organization: Organization = {
  id: "org-1",
  name: "Sharma Enterprises",
  slug: "sharma-enterprises",
  displayName: null,
  businessType: null,
  gstNumber: null,
  panNumber: null,
  cinNumber: null,
  phone: "+91 98765 43210",
  email: "info@sharma.com",
  website: null,
  addressLine1: "12 MG Road",
  addressLine2: null,
  city: "Bengaluru",
  state: "Karnataka",
  country: "IN",
  pincode: "560001",
  logoUrl: null,
  verificationStatus: "unverified",
  status: "active",
  plan: "free",
  planExpiresAt: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  createdBy: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("OrganizationProfileForm", () => {
  it("renders the heading and prefills the current organization values", () => {
    render(
      <OrganizationProfileForm
        organizationId="org-1"
        organization={organization}
      />
    );

    expect(
      screen.getByRole("heading", { name: /organization profile/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/organization name/i)).toHaveValue(
      "Sharma Enterprises"
    );
    expect(screen.getByLabelText(/city/i)).toHaveValue("Bengaluru");
    expect(screen.getByLabelText(/state/i)).toHaveValue("Karnataka");
    expect(screen.getByLabelText(/pincode/i)).toHaveValue("560001");
  });

  it("shows helper text explaining the state drives GST", () => {
    render(
      <OrganizationProfileForm
        organizationId="org-1"
        organization={organization}
      />
    );

    expect(
      screen.getByText(/cgst\/sgst vs igst on sales orders and invoices/i)
    ).toBeInTheDocument();
  });

  it("submits the entered values to the update action and shows success", async () => {
    mockUpdateOrganization.mockResolvedValue({
      success: true,
      data: { ...organization, state: "Maharashtra" },
    });
    const user = userEvent.setup();
    render(
      <OrganizationProfileForm
        organizationId="org-1"
        organization={organization}
      />
    );

    await user.selectOptions(screen.getByLabelText(/state/i), "Maharashtra");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(mockUpdateOrganization).toHaveBeenCalledTimes(1)
    );
    const [orgId, formData] = mockUpdateOrganization.mock.calls[0] as [
      string,
      FormData,
    ];
    expect(orgId).toBe("org-1");
    expect(formData.get("name")).toBe("Sharma Enterprises");
    expect(formData.get("state")).toBe("Maharashtra");

    await waitFor(() =>
      expect(mockToastSuccess).toHaveBeenCalledWith(
        "Organization updated",
        expect.objectContaining({
          description: expect.stringMatching(/saved/i),
        })
      )
    );
  });

  it("surfaces a server error returned by the action", async () => {
    mockUpdateOrganization.mockResolvedValue({
      success: false,
      error: { code: "unknown", message: "Something went wrong" },
    });
    const user = userEvent.setup();
    render(
      <OrganizationProfileForm
        organizationId="org-1"
        organization={organization}
      />
    );

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(
      await screen.findByText(/something went wrong/i)
    ).toBeInTheDocument();
  });
});
