import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@/tests/utils";
import { OrderDetailView } from "./order-detail-view";
import type {
  MarketplaceOrder,
  MarketplacePayment,
  OrderWithPayment,
} from "@/features/marketplace-orders/types/marketplace-orders.types";

const { mockRefresh } = vi.hoisted(() => ({ mockRefresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: mockRefresh }),
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
    transitionOrderAction: vi.fn(),
    paymentAction: vi.fn(),
  })
);

function makeOrder(overrides: Partial<MarketplaceOrder> = {}): MarketplaceOrder {
  return {
    id: "order-abc12345",
    organizationId: "buyer-org",
    sellerOrganizationId: "seller-org",
    listingId: null,
    status: "pending",
    quantity: 2,
    totalAmount: 200,
    currency: "INR",
    notes: "Please rush",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    createdBy: null,
    version: 1,
    ...overrides,
  };
}

function makeData(
  order: Partial<MarketplaceOrder> = {},
  payment: MarketplacePayment | null = null
): OrderWithPayment {
  return { order: makeOrder(order), payment };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("OrderDetailView", () => {
  it("renders the summary and total", () => {
    render(
      <OrderDetailView
        organizationId="buyer-org"
        data={makeData()}
        canTransact
      />
    );
    expect(
      screen.getByRole("heading", { name: /order order-ab/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Please rush/)).toBeInTheDocument();
    expect(screen.getByText(/you are the buyer/i)).toBeInTheDocument();
  });

  it("shows seller actions (confirm + cancel) on a pending order", () => {
    render(
      <OrderDetailView
        organizationId="seller-org"
        data={makeData()}
        canTransact
      />
    );
    expect(
      screen.getByRole("button", { name: /^confirm$/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^cancel$/i })
    ).toBeInTheDocument();
  });

  it("offers the buyer the pay-into-escrow action when no payment exists", () => {
    render(
      <OrderDetailView
        organizationId="buyer-org"
        data={makeData({ status: "confirmed" })}
        canTransact
      />
    );
    expect(
      screen.getByRole("button", { name: /pay into escrow/i })
    ).toBeInTheDocument();
  });

  it("shows the held payment state and a release action for the buyer", () => {
    const payment: MarketplacePayment = {
      id: "pay-1",
      organizationId: "buyer-org",
      counterpartyOrganizationId: "seller-org",
      orderId: "order-abc12345",
      provider: "manual",
      status: "held",
      amount: 200,
      currency: "INR",
      externalReference: "manual:hold:pay-1",
      notes: null,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      createdBy: null,
      version: 2,
    };
    render(
      <OrderDetailView
        organizationId="buyer-org"
        data={makeData({ status: "fulfilled" }, payment)}
        canTransact
      />
    );
    expect(screen.getByText(/held in escrow/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /release to seller/i })
    ).toBeInTheDocument();
  });

  it("hides action buttons when the user cannot transact", () => {
    render(
      <OrderDetailView
        organizationId="seller-org"
        data={makeData()}
        canTransact={false}
      />
    );
    expect(
      screen.queryByRole("button", { name: /^confirm$/i })
    ).not.toBeInTheDocument();
  });
});
