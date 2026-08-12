import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/tests/utils";
import { ConnectionCard } from "./ConnectionCard";
import type { BusinessConnection } from "@/features/cbn/types/cbn.types";

const { mockDisconnect, mockRemove } = vi.hoisted(() => ({
  mockDisconnect: vi.fn(),
  mockRemove: vi.fn(),
}));

vi.mock("@/features/cbn/actions/connection.actions", () => ({
  disconnectBusiness: mockDisconnect,
  removeConnection: mockRemove,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function makeConnection(
  overrides: Partial<BusinessConnection> = {}
): BusinessConnection {
  return {
    id: "conn-1",
    organizationId: "org-1",
    requesterOrganizationId: "org-1",
    recipientOrganizationId: "org-2",
    status: "accepted",
    connectionMessage: null,
    requesterGrants: [],
    recipientGrants: [],
    requestedAt: new Date("2026-01-01T10:00:00Z"),
    acceptedAt: new Date("2026-02-01T10:00:00Z"),
    rejectedAt: null,
    disconnectedAt: null,
    rejectionReason: null,
  requesterCounterpartyRole: null,
    createdAt: new Date("2026-01-01T10:00:00Z"),
    updatedAt: new Date("2026-01-01T10:00:00Z"),
    createdBy: null,
    ...overrides,
  };
}

describe("ConnectionCard", () => {
  it("renders the other org name, business id and a link to the detail page", () => {
    render(
      <ConnectionCard
        connection={makeConnection()}
        myOrgId="org-1"
        otherOrgName="Acme Steel"
        otherBusinessId="SYN-MH-123456"
      />
    );
    expect(screen.getByText("Acme Steel")).toBeInTheDocument();
    expect(screen.getByText("SYN-MH-123456")).toBeInTheDocument();
    expect(screen.getByText("AC")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /view connection with acme steel/i })
    ).toHaveAttribute("href", "/cbn/connections/conn-1");
  });

  it("shows a Connected status with the accepted date", () => {
    render(
      <ConnectionCard
        connection={makeConnection({ status: "accepted" })}
        myOrgId="org-1"
        otherOrgName="Acme Steel"
      />
    );
    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.getByText(/Connected 1 Feb 2026/)).toBeInTheDocument();
  });

  it("shows a Pending status with the requested date", () => {
    render(
      <ConnectionCard
        connection={makeConnection({ status: "pending", acceptedAt: null })}
        myOrgId="org-1"
        otherOrgName="Acme Steel"
      />
    );
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText(/Requested 1 Jan 2026/)).toBeInTheDocument();
  });

  it("shows a Rejected status with the rejected date", () => {
    render(
      <ConnectionCard
        connection={makeConnection({
          status: "rejected",
          acceptedAt: null,
          rejectedAt: new Date("2026-03-01T10:00:00Z"),
        })}
        myOrgId="org-1"
        otherOrgName="Acme Steel"
      />
    );
    expect(screen.getByText("Rejected")).toBeInTheDocument();
    expect(screen.getByText(/Rejected 1 Mar 2026/)).toBeInTheDocument();
  });

  it("shows a Disconnected status with the disconnected date", () => {
    render(
      <ConnectionCard
        connection={makeConnection({
          status: "disconnected",
          acceptedAt: null,
          disconnectedAt: new Date("2026-04-01T10:00:00Z"),
        })}
        myOrgId="org-1"
        otherOrgName="Acme Steel"
      />
    );
    expect(screen.getByText("Disconnected")).toBeInTheDocument();
    expect(screen.getByText(/Disconnected 1 Apr 2026/)).toBeInTheDocument();
  });

  it("falls back to an em dash when the relevant date is missing", () => {
    render(
      <ConnectionCard
        connection={makeConnection({ status: "accepted", acceptedAt: null })}
        myOrgId="org-1"
        otherOrgName="Acme Steel"
      />
    );
    expect(screen.getByText(/Connected —/)).toBeInTheDocument();
  });

  it("renders the blocked status using the requested date label", () => {
    render(
      <ConnectionCard
        connection={makeConnection({ status: "blocked", acceptedAt: null })}
        myOrgId="org-1"
        otherOrgName="Acme Steel"
      />
    );
    expect(screen.getByText("Blocked")).toBeInTheDocument();
    expect(screen.getByText(/^1 Jan 2026$/)).toBeInTheDocument();
  });

  it("omits the business id line when not provided", () => {
    render(
      <ConnectionCard
        connection={makeConnection()}
        myOrgId="org-1"
        otherOrgName="Acme Steel"
      />
    );
    expect(screen.queryByText("SYN-MH-123456")).not.toBeInTheDocument();
  });

  // ── Row actions ──────────────────────────────────────────────
  function renderCard(overrides: Partial<BusinessConnection> = {}) {
    return render(
      <ConnectionCard
        connection={makeConnection(overrides)}
        myOrgId="org-1"
        otherOrgName="Acme Steel"
      />
    );
  }

  const rejected = {
    status: "rejected" as const,
    acceptedAt: null,
    rejectedAt: new Date("2026-03-01T10:00:00Z"),
  };

  it("offers disconnect on a connected row", () => {
    renderCard();
    expect(
      screen.getByRole("button", { name: /disconnect from acme steel/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /remove acme steel/i })
    ).not.toBeInTheDocument();
  });

  it("offers remove on a rejected row instead of disconnect", () => {
    renderCard(rejected);
    expect(
      screen.getByRole("button", { name: /remove acme steel from your network/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /disconnect/i })
    ).not.toBeInTheDocument();
  });

  it("offers no row action while a request is pending", () => {
    renderCard({ status: "pending", acceptedAt: null });
    expect(
      screen.queryByRole("button", { name: /disconnect|remove/i })
    ).not.toBeInTheDocument();
  });

  it("disconnects after the user confirms", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockDisconnect.mockResolvedValue({ success: true, data: undefined });
    const user = userEvent.setup();
    renderCard();

    await user.click(
      screen.getByRole("button", { name: /disconnect from acme steel/i })
    );

    await waitFor(() => {
      expect(mockDisconnect).toHaveBeenCalledWith("conn-1", "org-1");
    });
  });

  it("does nothing when the user cancels the confirm", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();
    renderCard();

    await user.click(
      screen.getByRole("button", { name: /disconnect from acme steel/i })
    );

    expect(mockDisconnect).not.toHaveBeenCalled();
  });

  it("removes a rejected row and surfaces failures", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockRemove.mockResolvedValue({
      success: false,
      error: { code: "unknown", message: "Could not remove the connection" },
    });
    const user = userEvent.setup();
    renderCard(rejected);

    await user.click(
      screen.getByRole("button", { name: /remove acme steel from your network/i })
    );

    expect(
      await screen.findByText(/could not remove the connection/i)
    ).toBeInTheDocument();
  });
});
