import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/tests/utils";
import { ConnectionRequestDialog } from "./ConnectionRequestDialog";

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }));

vi.mock("@/features/cbn/actions/connection.actions", () => ({
  sendConnectionRequest: mockSend,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const CUSTOMERS = [{ id: "cust-1", code: "CUS-001", name: "Bharat Traders" }];
const SUPPLIERS = [{ id: "sup-1", code: "SUP-001", name: "Acme Steel Co" }];

function renderDialog(
  props: Partial<React.ComponentProps<typeof ConnectionRequestDialog>> = {}
) {
  return render(
    <ConnectionRequestDialog
      recipientOrgId="org-2"
      recipientName="Acme Steel"
      requesterOrgId="org-1"
      open
      onClose={vi.fn()}
      customers={CUSTOMERS}
      suppliers={SUPPLIERS}
      {...props}
    />
  );
}

/** Fills the now-mandatory relationship fields so submission can proceed. */
async function pickSupplier(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /^supplier/i }));
  await user.selectOptions(
    screen.getByLabelText(/which of your suppliers/i),
    "sup-1"
  );
}

describe("ConnectionRequestDialog", () => {
  it("renders nothing when closed", () => {
    renderDialog({ open: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders the dialog with the recipient name when open", () => {
    renderDialog();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /connect with acme steel/i })
    ).toBeInTheDocument();
  });

  it("updates the character counter as the user types", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.type(screen.getByLabelText(/message/i), "Hello");
    expect(screen.getByText("5/500")).toBeInTheDocument();
  });

  it("submits the request with the entered message and fires success callbacks", async () => {
    mockSend.mockResolvedValue({ success: true, data: "conn-99" });
    const onSuccess = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderDialog({ onSuccess, onClose });

    await user.type(screen.getByLabelText(/message/i), "Let us connect");
    await pickSupplier(user);
    await user.click(screen.getByRole("button", { name: /send request/i }));

    await waitFor(() => expect(mockSend).toHaveBeenCalledTimes(1));
    const formData = mockSend.mock.calls[0]?.[0] as FormData;
    expect(formData.get("requesterOrgId")).toBe("org-1");
    expect(formData.get("recipientOrgId")).toBe("org-2");
    expect(formData.get("message")).toBe("Let us connect");

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith("conn-99"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("omits the message field when left blank", async () => {
    mockSend.mockResolvedValue({ success: true, data: "conn-1" });
    const user = userEvent.setup();
    renderDialog();

    await pickSupplier(user);
    await user.click(screen.getByRole("button", { name: /send request/i }));

    await waitFor(() => expect(mockSend).toHaveBeenCalledTimes(1));
    const formData = mockSend.mock.calls[0]?.[0] as FormData;
    expect(formData.get("message")).toBeNull();
  });

  it("displays the server error when the request fails", async () => {
    mockSend.mockResolvedValue({
      success: false,
      error: { code: "duplicate", message: "Connection request already exists" },
    });
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderDialog({ onClose });

    await pickSupplier(user);
    await user.click(screen.getByRole("button", { name: /send request/i }));

    expect(
      await screen.findByRole("alert")
    ).toHaveTextContent(/connection request already exists/i);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes when the Cancel button is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderDialog({ onClose });
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes when the backdrop is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderDialog({ onClose });
    await user.click(screen.getByRole("dialog").querySelector(
      "[aria-hidden='true']"
    ) as Element);
    expect(onClose).toHaveBeenCalled();
  });

  // ── Relationship + party linking ─────────────────────────────
  it("requires a relationship before sending", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: /send request/i }));

    expect(
      await screen.findByText(/whether they are your customer or supplier/i)
    ).toBeInTheDocument();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("offers customers when they are the customer, suppliers when supplier", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: /^customer/i }));
    expect(screen.getByRole("option", { name: /bharat traders/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^supplier/i }));
    expect(screen.getByRole("option", { name: /acme steel co/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /bharat traders/i })
    ).not.toBeInTheDocument();
  });

  it("requires a party once a relationship is chosen", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: /^supplier/i }));
    await user.click(screen.getByRole("button", { name: /send request/i }));

    expect(
      await screen.findByText(/select which of your suppliers/i)
    ).toBeInTheDocument();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("submits the relationship and the linked party", async () => {
    mockSend.mockResolvedValue({ success: true, data: "conn-1" });
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: /^supplier/i }));
    await user.selectOptions(
      screen.getByLabelText(/which of your suppliers/i),
      "sup-1"
    );
    await user.click(screen.getByRole("button", { name: /send request/i }));

    await waitFor(() => expect(mockSend).toHaveBeenCalledTimes(1));
    const formData = mockSend.mock.calls[0]?.[0] as FormData;
    expect(formData.get("counterpartyRole")).toBe("supplier");
    expect(formData.get("linkEntityId")).toBe("sup-1");
  });

  it("guides the user to add a record when the book is empty", async () => {
    const user = userEvent.setup();
    renderDialog({ suppliers: [] });

    await user.click(screen.getByRole("button", { name: /^supplier/i }));

    expect(
      screen.getByText(/you have no unlinked suppliers/i)
    ).toBeInTheDocument();
  });
});
