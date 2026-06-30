import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/tests/utils";
import { SerialForm } from "./serial-form";
import type { SerialNumber } from "@/features/serial/types/serial.types";

// ─────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────

const { mockCreate, mockBulk, mockUpdate, mockRefresh } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockBulk: vi.fn(),
  mockUpdate: vi.fn(),
  mockRefresh: vi.fn(),
}));

vi.mock("@/features/serial/actions/serial.actions", () => ({
  createSerialAction: mockCreate,
  bulkCreateSerialsAction: mockBulk,
  updateSerialAction: mockUpdate,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: mockRefresh }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────

const PROD = "11111111-1111-1111-1111-111111111111";
const PRODUCTS = [{ id: PROD, name: "Laptop", code: "LAP-1" }];
const BRANCHES = [{ id: "22222222-2222-2222-2222-222222222222", name: "Main" }];

function makeSerial(overrides: Partial<SerialNumber> = {}): SerialNumber {
  return {
    id: "ser-1",
    organizationId: "org-1",
    productId: PROD,
    productName: "Laptop",
    productCode: "LAP-1",
    branchId: null,
    batchId: null,
    serialNumber: "SN-0001",
    status: "in_stock",
    referenceType: null,
    referenceId: null,
    notes: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    createdBy: null,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// Create mode
// ─────────────────────────────────────────────────────────────

describe("SerialForm (create)", () => {
  it("renders the register heading and bulk textarea", () => {
    render(
      <SerialForm
        organizationId="org-1"
        products={PRODUCTS}
        branches={BRANCHES}
      />
    );
    expect(
      screen.getByRole("heading", { name: /register serial numbers/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/serial numbers/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /register serials/i })
    ).toBeInTheDocument();
  });

  it("shows a validation error when no serials are entered", async () => {
    const user = userEvent.setup();
    render(
      <SerialForm
        organizationId="org-1"
        products={PRODUCTS}
        branches={BRANCHES}
      />
    );

    await user.selectOptions(screen.getByLabelText(/product/i), PROD);
    await user.click(screen.getByRole("button", { name: /register serials/i }));

    expect(
      await screen.findByText(/enter at least one serial number/i)
    ).toBeInTheDocument();
    expect(mockBulk).not.toHaveBeenCalled();
  });

  it("submits bulk serials and calls onSuccess when all are created", async () => {
    mockBulk.mockResolvedValue({
      success: true,
      data: { created: 2, skipped: 0, errors: [] },
    });
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(
      <SerialForm
        organizationId="org-1"
        products={PRODUCTS}
        branches={BRANCHES}
        onSuccess={onSuccess}
      />
    );

    await user.selectOptions(screen.getByLabelText(/product/i), PROD);
    await user.type(
      screen.getByLabelText(/serial numbers/i),
      "SN-1\nSN-2"
    );
    await user.click(screen.getByRole("button", { name: /register serials/i }));

    await waitFor(() => expect(mockBulk).toHaveBeenCalledTimes(1));
    const [orgId, formData] = mockBulk.mock.calls[0] as [string, FormData];
    expect(orgId).toBe("org-1");
    expect(formData.get("productId")).toBe(PROD);
    expect(formData.get("serialNumbers")).toBe("SN-1\nSN-2");
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });

  it("shows a summary when some serials are skipped", async () => {
    mockBulk.mockResolvedValue({
      success: true,
      data: {
        created: 1,
        skipped: 1,
        errors: [{ serial: "SN-1", message: "exists" }],
      },
    });
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(
      <SerialForm
        organizationId="org-1"
        products={PRODUCTS}
        branches={BRANCHES}
        onSuccess={onSuccess}
      />
    );

    await user.selectOptions(screen.getByLabelText(/product/i), PROD);
    await user.type(screen.getByLabelText(/serial numbers/i), "SN-1\nSN-2");
    await user.click(screen.getByRole("button", { name: /register serials/i }));

    expect(
      await screen.findByText(/1 serial\(s\) registered, 1 skipped/i)
    ).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("shows the server error when the action rejects the input", async () => {
    mockBulk.mockResolvedValue({
      success: false,
      error: { code: "forbidden", message: "Not allowed" },
    });
    const user = userEvent.setup();
    render(
      <SerialForm
        organizationId="org-1"
        products={PRODUCTS}
        branches={BRANCHES}
      />
    );

    await user.selectOptions(screen.getByLabelText(/product/i), PROD);
    await user.type(screen.getByLabelText(/serial numbers/i), "SN-1");
    await user.click(screen.getByRole("button", { name: /register serials/i }));

    expect(await screen.findByText("Not allowed")).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
// Edit mode
// ─────────────────────────────────────────────────────────────

describe("SerialForm (edit)", () => {
  it("pre-fills the serial and shows the status select", () => {
    render(
      <SerialForm
        organizationId="org-1"
        products={PRODUCTS}
        branches={BRANCHES}
        serial={makeSerial({ serialNumber: "SN-9", status: "reserved" })}
      />
    );
    expect(
      screen.getByRole("heading", { name: /edit serial number/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/serial number/i)).toHaveValue("SN-9");
    expect(screen.getByLabelText(/status/i)).toBeInTheDocument();
  });

  it("submits an update via updateSerialAction with the serial id", async () => {
    mockUpdate.mockResolvedValue({ success: true, data: makeSerial() });
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(
      <SerialForm
        organizationId="org-1"
        products={PRODUCTS}
        branches={BRANCHES}
        serial={makeSerial()}
        onSuccess={onSuccess}
      />
    );

    await user.selectOptions(screen.getByLabelText(/status/i), "sold");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    const [orgId, serialId, formData] = mockUpdate.mock.calls[0] as [
      string,
      string,
      FormData,
    ];
    expect(orgId).toBe("org-1");
    expect(serialId).toBe("ser-1");
    expect(formData.get("serialNumber")).toBe("SN-0001");
    expect(formData.get("status")).toBe("sold");
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });
});
