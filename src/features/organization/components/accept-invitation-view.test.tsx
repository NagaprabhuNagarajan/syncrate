import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/tests/utils";
import { AcceptInvitationView } from "./accept-invitation-view";

// ─────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────

const { mockAcceptInvitation } = vi.hoisted(() => ({
  mockAcceptInvitation: vi.fn(),
}));

vi.mock("@/features/organization/actions/organization.actions", () => ({
  acceptInvitationAction: mockAcceptInvitation,
}));

const TOKEN = "invite-token-123";

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("AcceptInvitationView", () => {
  it("renders the idle prompt with an accept button", () => {
    render(<AcceptInvitationView token={TOKEN} />);

    expect(
      screen.getByRole("heading", { name: /accept your invitation/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /accept invitation/i })
    ).toBeInTheDocument();
    expect(mockAcceptInvitation).not.toHaveBeenCalled();
  });

  it("calls the action with the token and shows success with org name + dashboard link", async () => {
    mockAcceptInvitation.mockResolvedValue({
      success: true,
      data: { id: "org-1", name: "Acme Industries" },
    });
    const user = userEvent.setup();
    render(<AcceptInvitationView token={TOKEN} />);

    await user.click(
      screen.getByRole("button", { name: /accept invitation/i })
    );

    await waitFor(() =>
      expect(mockAcceptInvitation).toHaveBeenCalledWith(TOKEN)
    );

    expect(
      await screen.findByText(/you've joined acme industries/i)
    ).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /go to dashboard/i });
    expect(link).toHaveAttribute("href", "/dashboard");
  });

  it("shows an error state when the action fails", async () => {
    mockAcceptInvitation.mockResolvedValue({
      success: false,
      error: { code: "invitation_expired", message: "Invitation has expired" },
    });
    const user = userEvent.setup();
    render(<AcceptInvitationView token={TOKEN} />);

    await user.click(
      screen.getByRole("button", { name: /accept invitation/i })
    );

    expect(
      await screen.findByText(/invitation has expired/i)
    ).toBeInTheDocument();
  });

  it("allows retrying after an error", async () => {
    mockAcceptInvitation
      .mockResolvedValueOnce({
        success: false,
        error: { code: "unknown", message: "Something failed" },
      })
      .mockResolvedValueOnce({
        success: true,
        data: { id: "org-1", name: "Acme Industries" },
      });
    const user = userEvent.setup();
    render(<AcceptInvitationView token={TOKEN} />);

    await user.click(
      screen.getByRole("button", { name: /accept invitation/i })
    );
    expect(await screen.findByText(/something failed/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /try again/i }));

    expect(
      await screen.findByText(/you've joined acme industries/i)
    ).toBeInTheDocument();
    expect(mockAcceptInvitation).toHaveBeenCalledTimes(2);
  });
});
