import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/tests/utils";
import { ShipmentsView } from "./shipments-view";
import type {
  Shipment,
  ShipmentListResult,
} from "@/features/marketplace-logistics/types/logistics.types";

const { mockPush, mockRefresh, searchParamsRef, advanceMock } = vi.hoisted(
  () => ({
    mockPush: vi.fn(),
    mockRefresh: vi.fn(),
    searchParamsRef: { current: "" },
    advanceMock: vi.fn(),
  })
);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: mockRefresh }),
  useSearchParams: () => new URLSearchParams(searchParamsRef.current),
}));

vi.mock("@/features/marketplace-logistics/actions/shipment.actions", () => ({
  advanceShipmentAction: advanceMock,
  createShipmentAction: vi.fn(),
}));

const ORG = "org-1";
const OTHER = "org-2";

beforeEach(() => {
  vi.clearAllMocks();
  searchParamsRef.current = "";
});

function makeShipment(overrides: Partial<Shipment> = {}): Shipment {
  return {
    id: "ship-1",
    organizationId: ORG,
    counterpartyOrganizationId: OTHER,
    orderId: "order-aaa",
    provider: "manual",
    carrier: "Blue Dart",
    trackingNumber: "BD123",
    status: "pending",
    shippedAt: null,
    deliveredAt: null,
    notes: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    createdBy: null,
    version: 1,
    ...overrides,
  };
}

function makeResult(
  overrides: Partial<ShipmentListResult> = {}
): ShipmentListResult {
  return {
    items: [makeShipment()],
    total: 1,
    page: 1,
    pageSize: 20,
    ...overrides,
  };
}

describe("ShipmentsView", () => {
  it("renders the heading, a row and the new-shipment button when canManage", () => {
    render(
      <ShipmentsView
        organizationId={ORG}
        result={makeResult()}
        filters={{}}
        canManage
      />
    );
    expect(
      screen.getByRole("heading", { name: /shipments/i })
    ).toBeInTheDocument();
    expect(screen.getByText("order-aaa")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /new shipment/i })
    ).toBeInTheDocument();
  });

  it("hides management controls when the user cannot manage", () => {
    render(
      <ShipmentsView
        organizationId={ORG}
        result={makeResult()}
        filters={{}}
        canManage={false}
      />
    );
    expect(
      screen.queryByRole("button", { name: /new shipment/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /mark in transit/i })
    ).not.toBeInTheDocument();
  });

  it("renders an empty state when there are no shipments", () => {
    render(
      <ShipmentsView
        organizationId={ORG}
        result={makeResult({ items: [], total: 0 })}
        filters={{}}
        canManage
      />
    );
    expect(screen.getByText(/no shipments yet/i)).toBeInTheDocument();
  });

  it("opens the create form when new shipment is clicked", async () => {
    const user = userEvent.setup();
    render(
      <ShipmentsView
        organizationId={ORG}
        result={makeResult()}
        filters={{}}
        canManage
      />
    );
    await user.click(screen.getByRole("button", { name: /new shipment/i }));
    expect(
      screen.getByRole("form", { name: /create shipment/i })
    ).toBeInTheDocument();
  });

  it("labels the shipper's row as Outbound with seller actions", () => {
    render(
      <ShipmentsView
        organizationId={ORG}
        result={makeResult({ items: [makeShipment({ status: "pending" })] })}
        filters={{}}
        canManage
      />
    );
    expect(screen.getByText("Outbound")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /mark in transit for order order-aaa/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /cancel for order order-aaa/i })
    ).toBeInTheDocument();
  });

  it("labels a recipient's row as Inbound and only allows confirming delivery", () => {
    render(
      <ShipmentsView
        organizationId={ORG}
        result={makeResult({
          items: [
            makeShipment({
              organizationId: OTHER,
              counterpartyOrganizationId: ORG,
              status: "in_transit",
            }),
          ],
        })}
        filters={{}}
        canManage
      />
    );
    expect(screen.getByText("Inbound")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /confirm delivery for order order-aaa/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^cancel for order/i })
    ).not.toBeInTheDocument();
  });

  it("shows no actions for a delivered shipment", () => {
    render(
      <ShipmentsView
        organizationId={ORG}
        result={makeResult({ items: [makeShipment({ status: "delivered" })] })}
        filters={{}}
        canManage
      />
    );
    expect(screen.getByText(/no actions/i)).toBeInTheDocument();
  });

  it("invokes the advance action with the shipment's version and refreshes", async () => {
    advanceMock.mockResolvedValue({ success: true, data: makeShipment() });
    const user = userEvent.setup();
    render(
      <ShipmentsView
        organizationId={ORG}
        result={makeResult({
          items: [makeShipment({ status: "pending", version: 4 })],
        })}
        filters={{}}
        canManage
      />
    );
    await user.click(
      screen.getByRole("button", { name: /mark in transit for order order-aaa/i })
    );
    expect(advanceMock).toHaveBeenCalledWith(ORG, "ship-1", "in_transit", 4);
  });

  it("surfaces an action error", async () => {
    advanceMock.mockResolvedValue({
      success: false,
      error: { code: "conflict", message: "Changed elsewhere" },
    });
    const user = userEvent.setup();
    render(
      <ShipmentsView
        organizationId={ORG}
        result={makeResult({ items: [makeShipment({ status: "pending" })] })}
        filters={{}}
        canManage
      />
    );
    await user.click(
      screen.getByRole("button", { name: /mark in transit for order order-aaa/i })
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /changed elsewhere/i
    );
  });

  it("updates the URL when the status filter changes", async () => {
    const user = userEvent.setup();
    render(
      <ShipmentsView
        organizationId={ORG}
        result={makeResult()}
        filters={{}}
        canManage
      />
    );
    await user.selectOptions(
      screen.getByLabelText(/filter by status/i),
      "delivered"
    );
    expect(mockPush).toHaveBeenCalledWith(
      "/marketplace/shipments?status=delivered"
    );
  });
});
