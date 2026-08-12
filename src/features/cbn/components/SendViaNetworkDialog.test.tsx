import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/tests/utils";
import { SendViaNetworkDialog } from "./SendViaNetworkDialog";
import type { NetworkTarget } from "./SendViaNetworkDialog";

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }));

vi.mock("@/features/cbn/actions/sync.actions", () => ({
  sendCbnInvoice: mockSend,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const TARGET: NetworkTarget = {
  connectionId: "conn-1",
  name: "Customer Com",
  businessId: "SYN-IN-000025",
};

function renderDialog(props: Partial<
  React.ComponentProps<typeof SendViaNetworkDialog>
> = {}) {
  return render(
    <SendViaNetworkDialog
      invoiceId="inv-1"
      organizationId="org-1"
      target={TARGET}
      onClose={vi.fn()}
      {...props}
    />
  );
}

describe("SendViaNetworkDialog", () => {
  it("states the recipient without offering a choice", () => {
    renderDialog();
    expect(screen.getByText("Customer Com")).toBeInTheDocument();
    expect(screen.getByText("SYN-IN-000025")).toBeInTheDocument();
    // The recipient follows from the invoice's customer, so there is nothing
    // to select — a radio here would imply a decision the user cannot make.
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("sends to the customer's connection", async () => {
    mockSend.mockResolvedValue({ success: true, data: "cbn-inv-1" });
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderDialog({ onClose });

    await user.click(screen.getByRole("button", { name: /send invoice/i }));

    await waitFor(() => {
      expect(mockSend).toHaveBeenCalledWith("inv-1", "conn-1", "org-1");
    });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("keeps the dialog open and shows the error when sending fails", async () => {
    mockSend.mockResolvedValue({
      success: false,
      error: { code: "permission_denied", message: "receive_invoices not granted" },
    });
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderDialog({ onClose });

    await user.click(screen.getByRole("button", { name: /send invoice/i }));

    expect(
      await screen.findByText(/receive_invoices not granted/i)
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes without sending when cancelled", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderDialog({ onClose });

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("renders without a business id", () => {
    renderDialog({ target: { connectionId: "conn-1", name: "Customer Com" } });
    expect(screen.getByText("Customer Com")).toBeInTheDocument();
    expect(screen.queryByText("SYN-IN-000025")).not.toBeInTheDocument();
  });
});
