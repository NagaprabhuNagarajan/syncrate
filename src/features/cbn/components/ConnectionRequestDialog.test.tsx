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
      {...props}
    />
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
});
