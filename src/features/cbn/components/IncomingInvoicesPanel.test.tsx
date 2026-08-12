import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/tests/utils";
import { IncomingInvoicesPanel } from "./IncomingInvoicesPanel";
import type { IncomingDocument } from "@/features/cbn/types/cbn.types";

const { mockAccept, mockReject, mockResolve } = vi.hoisted(() => ({
  mockAccept: vi.fn(),
  mockReject: vi.fn(),
  mockResolve: vi.fn(),
}));

vi.mock("@/features/cbn/actions/sync.actions", () => ({
  acceptCbnInvoice: mockAccept,
  rejectCbnInvoice: mockReject,
  resolveCbnInvoiceLines: mockResolve,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function makeIncoming(
  overrides: Partial<IncomingDocument> = {}
): IncomingDocument {
  return {
    id: "cbn-inv-1",
    connectionId: "conn-1",
    number: "INV-00001",
    date: "2026-07-20",
    totalAmount: 800,
    senderName: "Acme Steel",
    ...overrides,
  };
}

describe("IncomingInvoicesPanel", () => {
  it("shows an empty state when nothing is waiting", () => {
    render(
      <IncomingInvoicesPanel organizationId="org-1" invoices={[]} canManage />
    );
    expect(screen.getByText("No incoming invoices")).toBeInTheDocument();
  });

  it("lists the sender, number and amount", () => {
    render(
      <IncomingInvoicesPanel
        organizationId="org-1"
        invoices={[makeIncoming()]}
        canManage
      />
    );
    expect(screen.getByText("Acme Steel")).toBeInTheDocument();
    expect(screen.getByText("INV-00001")).toBeInTheDocument();
    expect(screen.getByText(/800/)).toBeInTheDocument();
  });

  it("opens the review dialog instead of accepting immediately", async () => {
    mockResolve.mockResolvedValue({ success: true, data: [] });
    const user = userEvent.setup();
    render(
      <IncomingInvoicesPanel
        organizationId="org-1"
        invoices={[makeIncoming()]}
        canManage
      />
    );

    await user.click(screen.getByRole("button", { name: /review and accept invoice INV-00001/i }));

    expect(
      await screen.findByRole("dialog", { name: /review and accept invoice/i })
    ).toBeInTheDocument();
    // Nothing is committed until every line is matched to a local product.
    expect(mockAccept).not.toHaveBeenCalled();
  });

  it("sends the typed reason when rejecting", async () => {
    vi.spyOn(window, "prompt").mockReturnValue("Wrong amount");
    mockReject.mockResolvedValue({ success: true, data: undefined });
    const user = userEvent.setup();
    render(
      <IncomingInvoicesPanel
        organizationId="org-1"
        invoices={[makeIncoming()]}
        canManage
      />
    );

    await user.click(screen.getByRole("button", { name: /reject invoice/i }));

    await waitFor(() => {
      expect(mockReject).toHaveBeenCalledWith(
        "cbn-inv-1",
        "org-1",
        "Wrong amount"
      );
    });
  });

  it("does not call the server when the reason is blank or cancelled", async () => {
    vi.spyOn(window, "prompt").mockReturnValue("   ");
    const user = userEvent.setup();
    render(
      <IncomingInvoicesPanel
        organizationId="org-1"
        invoices={[makeIncoming()]}
        canManage
      />
    );

    await user.click(screen.getByRole("button", { name: /reject invoice/i }));

    expect(mockReject).not.toHaveBeenCalled();
  });

  it("hides the actions without permission", () => {
    render(
      <IncomingInvoicesPanel
        organizationId="org-1"
        invoices={[makeIncoming()]}
        canManage={false}
      />
    );
    expect(
      screen.queryByRole("button", { name: /review and accept invoice/i })
    ).not.toBeInTheDocument();
    expect(screen.getByText("No permission")).toBeInTheDocument();
  });
});
