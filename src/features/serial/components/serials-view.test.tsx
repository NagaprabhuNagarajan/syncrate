import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/tests/utils";
import { SerialsView } from "./serials-view";
import type {
  SerialNumber,
  SerialListResult,
} from "@/features/serial/types/serial.types";

// ─────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────

const { mockPush, mockRefresh, searchParamsRef, updateActionMock, archiveActionMock } =
  vi.hoisted(() => ({
    mockPush: vi.fn(),
    mockRefresh: vi.fn(),
    searchParamsRef: { current: "" },
    updateActionMock: vi.fn(),
    archiveActionMock: vi.fn(),
  }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: mockRefresh }),
  useSearchParams: () => new URLSearchParams(searchParamsRef.current),
}));

vi.mock("@/features/serial/actions/serial.actions", () => ({
  updateSerialAction: updateActionMock,
  archiveSerialAction: archiveActionMock,
  createSerialAction: vi.fn(),
  bulkCreateSerialsAction: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  searchParamsRef.current = "";
});

// ─────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────

const PRODUCTS = [
  { id: "prod-1", name: "Laptop", code: "LAP-1" },
  { id: "prod-2", name: "Printer", code: "PRN-1" },
];
const BRANCHES = [{ id: "wh-1", name: "Main Branch" }];

function makeSerial(overrides: Partial<SerialNumber> = {}): SerialNumber {
  return {
    id: "ser-1",
    organizationId: "org-1",
    productId: "prod-1",
    productName: "Laptop",
    productCode: "LAP-1",
    branchId: "wh-1",
    batchId: null,
    serialNumber: "SN-0001",
    status: "in_stock",
    referenceType: null,
    referenceId: null,
    notes: "first unit",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    createdBy: null,
    ...overrides,
  };
}

function makeResult(
  overrides: Partial<SerialListResult> = {}
): SerialListResult {
  return {
    items: [makeSerial()],
    total: 1,
    page: 1,
    pageSize: 20,
    ...overrides,
  };
}

function renderView(props: Partial<Parameters<typeof SerialsView>[0]> = {}) {
  return render(
    <SerialsView
      organizationId="org-1"
      result={makeResult()}
      products={PRODUCTS}
      branches={BRANCHES}
      filters={{}}
      canManage
      {...props}
    />
  );
}

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("SerialsView", () => {
  it("renders the heading, a row and the register button when canManage", () => {
    renderView();
    expect(
      screen.getByRole("heading", { name: /serial numbers/i })
    ).toBeInTheDocument();
    expect(screen.getByText("SN-0001")).toBeInTheDocument();
    expect(screen.getByText("Main Branch")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /register serials/i })
    ).toBeInTheDocument();
  });

  it("hides management controls when the user cannot manage", () => {
    renderView({ canManage: false });
    expect(
      screen.queryByRole("button", { name: /register serials/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(/update status for/i)
    ).not.toBeInTheDocument();
  });

  it("renders an empty state when there are no serials", () => {
    renderView({ result: makeResult({ items: [], total: 0 }) });
    expect(screen.getByText(/no serial numbers found/i)).toBeInTheDocument();
  });

  it("updates the URL when a search is submitted", async () => {
    const user = userEvent.setup();
    renderView();
    await user.type(
      screen.getByLabelText(/search serial numbers/i),
      "SN-0001{Enter}"
    );
    expect(mockPush).toHaveBeenCalledWith("/inventory/serials?search=SN-0001");
  });

  it("updates the URL when the status filter changes", async () => {
    const user = userEvent.setup();
    renderView();
    await user.selectOptions(screen.getByLabelText(/filter by status/i), "sold");
    expect(mockPush).toHaveBeenCalledWith("/inventory/serials?status=sold");
  });

  it("updates the URL when the product filter changes", async () => {
    const user = userEvent.setup();
    renderView();
    await user.selectOptions(
      screen.getByLabelText(/filter by product/i),
      "prod-2"
    );
    expect(mockPush).toHaveBeenCalledWith(
      "/inventory/serials?productId=prod-2"
    );
  });

  it("paginates to the next page", async () => {
    const user = userEvent.setup();
    renderView({
      result: makeResult({
        items: [makeSerial(), makeSerial({ id: "ser-2" })],
        total: 45,
      }),
    });
    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(mockPush).toHaveBeenCalledWith("/inventory/serials?page=2");
  });

  it("calls the update action when the inline status is changed", async () => {
    updateActionMock.mockResolvedValue({ success: true, data: makeSerial() });
    const user = userEvent.setup();
    renderView();

    await user.selectOptions(
      screen.getByLabelText(/update status for SN-0001/i),
      "sold"
    );

    await waitFor(() =>
      expect(updateActionMock).toHaveBeenCalledWith(
        "org-1",
        "ser-1",
        expect.any(FormData)
      )
    );
    const sentForm = updateActionMock.mock.calls[0][2] as FormData;
    expect(sentForm.get("status")).toBe("sold");
  });

  it("surfaces an error when the status update fails", async () => {
    updateActionMock.mockResolvedValue({
      success: false,
      error: { code: "forbidden", message: "Not allowed" },
    });
    const user = userEvent.setup();
    renderView();

    await user.selectOptions(
      screen.getByLabelText(/update status for SN-0001/i),
      "damaged"
    );

    expect(await screen.findByText("Not allowed")).toBeInTheDocument();
  });

  it("calls the archive action when the archive button is clicked", async () => {
    archiveActionMock.mockResolvedValue({ success: true, data: undefined });
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByRole("button", { name: /archive SN-0001/i }));

    await waitFor(() =>
      expect(archiveActionMock).toHaveBeenCalledWith("org-1", "ser-1")
    );
  });

  it("opens the register dialog when register is clicked", async () => {
    const user = userEvent.setup();
    renderView();

    expect(
      screen.queryByRole("dialog", { name: /register serial numbers/i })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /register serials/i }));

    expect(
      screen.getByRole("dialog", { name: /register serial numbers/i })
    ).toBeInTheDocument();
  });

  it("opens the edit dialog when a serial number is clicked", async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByRole("button", { name: "SN-0001" }));

    expect(
      screen.getByRole("dialog", { name: /edit serial number/i })
    ).toBeInTheDocument();
  });

  it("renders an em dash for a missing branch", () => {
    renderView({
      result: makeResult({
        items: [makeSerial({ branchId: null, notes: null })],
      }),
    });
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
  });
});
