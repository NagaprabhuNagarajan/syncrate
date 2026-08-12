import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/tests/utils";
import { CustomerForm } from "./customer-form";
import type { Customer } from "@/features/customer/types/customer.types";

// ─────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────

const { mockCreate, mockUpdate, mockPush } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockPush: vi.fn(),
}));

vi.mock("@/features/customer/actions/customer.actions", () => ({
  createCustomerAction: mockCreate,
  updateCustomerAction: mockUpdate,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: vi.fn() }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: "cust-1",
    organizationId: "org-1",
    code: "CUST-001",
    name: "Kumar Traders",
    company: "Kumar Traders Pvt. Ltd.",
    gstNumber: null,
    panNumber: null,
    mobile: "+91 98765 43210",
    email: null,
    website: null,
    billingAddressLine1: null,
    billingAddressLine2: null,
    billingCity: null,
    billingState: null,
    billingPincode: null,
    billingCountry: "IN",
    shippingAddressLine1: null,
    shippingAddressLine2: null,
    shippingCity: null,
    shippingState: null,
    shippingPincode: null,
    shippingCountry: null,
    creditLimit: 50000,
    paymentTermsDays: 30,
    preferredPaymentMethod: null,
    openingBalance: 1000,
    status: "active",
    tags: ["vip", "wholesale"],
    notes: null,
    cbnConnectionId: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    createdBy: null,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("CustomerForm (create)", () => {
  it("renders the create heading and required name field", () => {
    render(<CustomerForm organizationId="org-1" />);
    expect(
      screen.getByRole("heading", { name: /add customer/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/customer name/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create customer/i })
    ).toBeInTheDocument();
  });

  it("shows a validation error and does not submit when the name is empty", async () => {
    const user = userEvent.setup();
    render(<CustomerForm organizationId="org-1" />);

    await user.click(screen.getByRole("button", { name: /create customer/i }));

    expect(
      await screen.findByText(/name must be at least 2 characters/i)
    ).toBeInTheDocument();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("submits FormData with an uppercased code, numbers and CSV tags", async () => {
    mockCreate.mockResolvedValue({ success: true, data: makeCustomer() });
    const user = userEvent.setup();
    render(<CustomerForm organizationId="org-1" />);

    await user.type(screen.getByLabelText(/customer name/i), "Kumar Traders");
    await user.type(screen.getByLabelText(/customer code/i), "cust-1");
    await user.type(screen.getByLabelText(/credit limit/i), "50000");
    await user.type(screen.getByLabelText(/^tags$/i), "vip, wholesale");
    await user.click(screen.getByRole("button", { name: /create customer/i }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    const [orgId, formData] = mockCreate.mock.calls[0] as [string, FormData];
    expect(orgId).toBe("org-1");
    expect(formData.get("name")).toBe("Kumar Traders");
    expect(formData.get("code")).toBe("CUST-1");
    expect(formData.get("creditLimit")).toBe("50000");
    expect(formData.get("tags")).toBe("vip, wholesale");
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/customers"));
  });

  it("displays a server error returned by the action", async () => {
    mockCreate.mockResolvedValue({
      success: false,
      error: {
        code: "duplicate_code",
        message: "A customer with code already exists",
      },
    });
    const user = userEvent.setup();
    render(<CustomerForm organizationId="org-1" />);

    await user.type(screen.getByLabelText(/customer name/i), "Kumar Traders");
    await user.click(screen.getByRole("button", { name: /create customer/i }));

    expect(
      await screen.findByText(/a customer with code already exists/i)
    ).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("calls onSuccess instead of navigating when provided", async () => {
    const onSuccess = vi.fn();
    mockCreate.mockResolvedValue({ success: true, data: makeCustomer() });
    const user = userEvent.setup();
    render(<CustomerForm organizationId="org-1" onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText(/customer name/i), "Kumar Traders");
    await user.click(screen.getByRole("button", { name: /create customer/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe("CustomerForm (edit)", () => {
  it("pre-fills fields from the customer and shows the status select", () => {
    render(
      <CustomerForm organizationId="org-1" customer={makeCustomer()} />
    );

    expect(
      screen.getByRole("heading", { name: /edit customer/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/customer name/i)).toHaveValue("Kumar Traders");
    expect(screen.getByLabelText(/^status$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^tags$/i)).toHaveValue("vip, wholesale");
  });

  it("submits an update via updateCustomerAction with the customer id", async () => {
    mockUpdate.mockResolvedValue({ success: true, data: makeCustomer() });
    const user = userEvent.setup();
    render(
      <CustomerForm organizationId="org-1" customer={makeCustomer()} />
    );

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    const [orgId, customerId, formData] = mockUpdate.mock.calls[0] as [
      string,
      string,
      FormData,
    ];
    expect(orgId).toBe("org-1");
    expect(customerId).toBe("cust-1");
    expect(formData.get("name")).toBe("Kumar Traders");
    expect(formData.get("status")).toBe("active");
  });

  it("submits the status chosen from the segmented control", async () => {
    mockUpdate.mockResolvedValue({ success: true, data: makeCustomer() });
    const user = userEvent.setup();
    render(<CustomerForm organizationId="org-1" customer={makeCustomer()} />);

    await user.click(screen.getByRole("radio", { name: "Blacklisted" }));
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    const [, , formData] = mockUpdate.mock.calls[0] as [
      string,
      string,
      FormData,
    ];
    expect(formData.get("status")).toBe("blacklisted");
  });
});
