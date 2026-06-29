import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/tests/utils";
import { OrdersView } from "./orders-view";
import type {
  MarketplaceOrder,
  OrderListResult,
} from "@/features/marketplace-orders/types/marketplace-orders.types";

const { mockPush, mockRefresh, searchParamsRef } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockRefresh: vi.fn(),
  searchParamsRef: { current: "" },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: mockRefresh }),
  useSearchParams: () => new URLSearchParams(searchParamsRef.current),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock(
  "@/features/marketplace-orders/actions/marketplace-orders.actions",
  () => ({
    placeOrderAction: vi.fn(),
  })
);

function makeOrder(overrides: Partial<MarketplaceOrder> = {}): MarketplaceOrder {
  return {
    id: "order-abc12345",
    organizationId: "org-1",
    sellerOrganizationId: "seller-9",
    listingId: null,
    status: "pending",
    quantity: 4,
    totalAmount: 400,
    currency: "INR",
    notes: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    createdBy: null,
    version: 1,
    ...overrides,
  };
}

function makeResult(
  overrides: Partial<OrderListResult> = {}
): OrderListResult {
  return { items: [makeOrder()], total: 1, page: 1, pageSize: 20, ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  searchParamsRef.current = "";
});

describe("OrdersView", () => {
  it("renders the heading, an order row and the place-order button when canTransact", () => {
    render(
      <OrdersView
        organizationId="org-1"
        result={makeResult()}
        filters={{ perspective: "all" }}
        canTransact
      />
    );
    expect(
      screen.getByRole("heading", { name: /orders/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /order-ab/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /place order/i })
    ).toBeInTheDocument();
  });

  it("hides the place-order button when the user cannot transact", () => {
    render(
      <OrdersView
        organizationId="org-1"
        result={makeResult()}
        filters={{ perspective: "all" }}
        canTransact={false}
      />
    );
    expect(
      screen.queryByRole("button", { name: /place order/i })
    ).not.toBeInTheDocument();
  });

  it("renders an empty state when there are no orders", () => {
    render(
      <OrdersView
        organizationId="org-1"
        result={makeResult({ items: [], total: 0 })}
        filters={{ perspective: "all" }}
        canTransact
      />
    );
    expect(screen.getByText(/no orders yet/i)).toBeInTheDocument();
  });

  it("updates the URL when the status filter changes", async () => {
    const user = userEvent.setup();
    render(
      <OrdersView
        organizationId="org-1"
        result={makeResult()}
        filters={{ perspective: "all" }}
        canTransact
      />
    );
    await user.selectOptions(
      screen.getByLabelText(/filter by status/i),
      "confirmed"
    );
    expect(mockPush).toHaveBeenCalledWith(
      "/marketplace/orders?status=confirmed"
    );
  });

  it("opens the place-order form", async () => {
    const user = userEvent.setup();
    render(
      <OrdersView
        organizationId="org-1"
        result={makeResult()}
        filters={{ perspective: "all" }}
        canTransact
      />
    );
    await user.click(screen.getByRole("button", { name: /place order/i }));
    expect(
      screen.getByRole("form", { name: /place order/i })
    ).toBeInTheDocument();
  });
});
