import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/tests/utils";
import { ConnectionDetail } from "./ConnectionDetail";
import type {
  BusinessConnection,
  CbnEvent,
  CbnSharedDocument,
  ConnectionStatus,
} from "@/features/cbn/types/cbn.types";

const {
  mockUpdatePermissions,
  mockDisconnect,
  mockAccept,
  mockReject,
  mockSendRequest,
  mockRemove,
} = vi.hoisted(() => ({
  mockUpdatePermissions: vi.fn(),
  mockDisconnect: vi.fn(),
  mockAccept: vi.fn(),
  mockReject: vi.fn(),
  mockSendRequest: vi.fn(),
  mockRemove: vi.fn(),
}));

vi.mock("@/features/cbn/actions/connection.actions", () => ({
  updateConnectionPermissions: mockUpdatePermissions,
  disconnectBusiness: mockDisconnect,
  acceptConnectionRequest: mockAccept,
  rejectConnectionRequest: mockReject,
  sendConnectionRequest: mockSendRequest,
  removeConnection: mockRemove,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function makeConnection(
  status: ConnectionStatus = "accepted",
  overrides: Partial<BusinessConnection> = {}
): BusinessConnection {
  return {
    id: "conn-1",
    organizationId: "org-1",
    requesterOrganizationId: "org-1",
    recipientOrganizationId: "org-2",
    status,
    connectionMessage: "Looking forward to working together",
    requesterGrants: [],
    recipientGrants: [],
    requestedAt: new Date("2026-01-01T10:00:00Z"),
    acceptedAt: status === "accepted" ? new Date("2026-02-01T10:00:00Z") : null,
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

const otherOrg = {
  name: "Acme Steel",
  businessId: "SYN-MH-123456",
  verificationLevel: 3,
  trustScore: 82,
};

const sharedDocuments: CbnSharedDocument[] = [
  {
    id: "doc-1",
    organizationId: "org-1",
    counterpartyOrganizationId: "org-2",
    connectionId: "conn-1",
    documentType: "tax_invoice",
    documentReferenceType: null,
    documentReferenceId: null,
    documentNumber: "INV-001",
    documentDate: "2026-03-01",
    amount: 15000,
    currency: "INR",
    fileUrl: null,
    fileName: null,
    status: "active",
    notes: null,
    createdAt: new Date("2026-03-01T10:00:00Z"),
    updatedAt: new Date("2026-03-01T10:00:00Z"),
    createdBy: null,
  },
];

const events: CbnEvent[] = [
  {
    id: "evt-1",
    organizationId: "org-1",
    connectionId: "conn-1",
    eventType: "connection_accepted",
    actorUserId: null,
    sourceOrganizationId: "org-1",
    targetOrganizationId: "org-2",
    referenceType: null,
    referenceId: null,
    correlationId: "corr-1",
    metadata: {},
    status: "success",
    errorMessage: null,
    createdAt: new Date("2026-02-01T10:00:00Z"),
  },
  {
    id: "evt-2",
    organizationId: "org-1",
    connectionId: "conn-1",
    eventType: "invoice_sync_failed",
    actorUserId: null,
    sourceOrganizationId: "org-1",
    targetOrganizationId: "org-2",
    referenceType: null,
    referenceId: null,
    correlationId: "corr-2",
    metadata: {},
    status: "failed",
    errorMessage: "Sync timed out",
    createdAt: new Date("2026-03-01T10:00:00Z"),
  },
];

function renderDetail(
  props: Partial<React.ComponentProps<typeof ConnectionDetail>> = {}
) {
  return render(
    <ConnectionDetail
      connection={makeConnection()}
      myOrgId="org-1"
      otherOrg={otherOrg}
      sharedDocuments={sharedDocuments}
      events={events}
      suppliers={[{ id: "sup-1", code: "SUP-001", name: "Acme Steel Co" }]}
      customers={[{ id: "cust-1", code: "CUS-001", name: "Bharat Traders" }]}
      {...props}
    />
  );
}

describe("ConnectionDetail", () => {
  it("renders the overview tab with the other org details", () => {
    renderDetail();
    expect(screen.getByText("Acme Steel")).toBeInTheDocument();
    expect(screen.getByText("SYN-MH-123456")).toBeInTheDocument();
    expect(
      screen.getByText(/looking forward to working together/i)
    ).toBeInTheDocument();
  });

  it("switches to the documents tab and renders the shared-document table", async () => {
    const user = userEvent.setup();
    renderDetail();
    await user.click(screen.getByRole("tab", { name: /documents/i }));
    expect(
      screen.getByRole("table", { name: /shared documents/i })
    ).toBeInTheDocument();
    expect(screen.getByText("INV-001")).toBeInTheDocument();
    expect(screen.getByText("tax invoice")).toBeInTheDocument();
  });

  it("shows an empty message when there are no shared documents", async () => {
    const user = userEvent.setup();
    renderDetail({ sharedDocuments: [] });
    await user.click(screen.getByRole("tab", { name: /documents/i }));
    expect(screen.getByText(/no shared documents yet/i)).toBeInTheDocument();
  });

  it("switches to the events tab and renders the timeline", async () => {
    const user = userEvent.setup();
    renderDetail();
    await user.click(screen.getByRole("tab", { name: /events/i }));
    expect(
      screen.getByRole("list", { name: /connection events/i })
    ).toBeInTheDocument();
    expect(screen.getByText("connection accepted")).toBeInTheDocument();
    expect(screen.getByText("invoice sync failed")).toBeInTheDocument();
    expect(screen.getByText("Sync timed out")).toBeInTheDocument();
  });

  it("shows an empty message when there are no events", async () => {
    const user = userEvent.setup();
    renderDetail({ events: [] });
    await user.click(screen.getByRole("tab", { name: /events/i }));
    expect(screen.getByText(/no events recorded yet/i)).toBeInTheDocument();
  });

  it("saves permissions with the selected grants", async () => {
    mockUpdatePermissions.mockResolvedValue({ success: true, data: undefined });
    const user = userEvent.setup();
    renderDetail();

    await user.click(
      screen.getByRole("checkbox", { name: /receive invoices/i })
    );
    await user.click(screen.getByRole("button", { name: /save permissions/i }));

    await waitFor(() =>
      expect(mockUpdatePermissions).toHaveBeenCalledWith("conn-1", "org-1", [
        "receive_invoices",
      ])
    );
    expect(await screen.findByText(/permissions saved/i)).toBeInTheDocument();
  });

  it("toggles an existing grant off before saving", async () => {
    mockUpdatePermissions.mockResolvedValue({ success: true, data: undefined });
    const user = userEvent.setup();
    renderDetail({
      connection: makeConnection("accepted", {
        requesterGrants: ["receive_invoices"],
      }),
    });

    await user.click(
      screen.getByRole("checkbox", { name: /receive invoices/i })
    );
    await user.click(screen.getByRole("button", { name: /save permissions/i }));

    await waitFor(() =>
      expect(mockUpdatePermissions).toHaveBeenCalledWith("conn-1", "org-1", [])
    );
  });

  it("uses the recipient grants when I am the recipient", async () => {
    mockUpdatePermissions.mockResolvedValue({ success: true, data: undefined });
    const user = userEvent.setup();
    renderDetail({
      connection: makeConnection("accepted", {
        requesterOrganizationId: "org-2",
        recipientOrganizationId: "org-1",
        recipientGrants: ["view_catalog"],
      }),
    });

    expect(
      screen.getByRole("checkbox", { name: /view supplier catalog/i })
    ).toBeChecked();
    await user.click(screen.getByRole("button", { name: /save permissions/i }));

    await waitFor(() =>
      expect(mockUpdatePermissions).toHaveBeenCalledWith("conn-1", "org-1", [
        "view_catalog",
      ])
    );
  });

  it("surfaces a permissions save error", async () => {
    mockUpdatePermissions.mockResolvedValue({
      success: false,
      error: { code: "permission_denied", message: "Permission denied" },
    });
    const user = userEvent.setup();
    renderDetail();

    await user.click(screen.getByRole("button", { name: /save permissions/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /permission denied/i
    );
  });

  it("disconnects after the user confirms", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    mockDisconnect.mockResolvedValue({ success: true, data: undefined });
    const user = userEvent.setup();
    renderDetail();

    await user.click(screen.getByRole("button", { name: /^disconnect$/i }));

    expect(confirmSpy).toHaveBeenCalled();
    await waitFor(() =>
      expect(mockDisconnect).toHaveBeenCalledWith("conn-1", "org-1")
    );
  });

  it("does not disconnect when the user cancels the confirm dialog", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();
    renderDetail();

    await user.click(screen.getByRole("button", { name: /^disconnect$/i }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(mockDisconnect).not.toHaveBeenCalled();
  });

  it("surfaces a disconnect error", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockDisconnect.mockResolvedValue({
      success: false,
      error: { code: "unknown", message: "Could not disconnect" },
    });
    const user = userEvent.setup();
    renderDetail();

    await user.click(screen.getByRole("button", { name: /^disconnect$/i }));

    expect(await screen.findByText(/could not disconnect/i)).toBeInTheDocument();
  });

  it("hides the permissions and danger zone for a pending connection", () => {
    renderDetail({ connection: makeConnection("pending", { acceptedAt: null }) });
    expect(
      screen.queryByRole("button", { name: /save permissions/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/danger zone/i)).not.toBeInTheDocument();
  });

  // ── Pending-request decisions ────────────────────────────────
  // The recipient decides; the requester only ever sees a wait message.
  const incoming = () =>
    makeConnection("pending", {
      acceptedAt: null,
      requesterOrganizationId: "org-2",
      recipientOrganizationId: "org-1",
    });

  it("offers accept and reject on an incoming pending request", () => {
    renderDetail({ connection: incoming() });
    expect(
      screen.getByRole("button", { name: /accept connection/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^reject$/i })).toBeInTheDocument();
  });

  it("tells the requester to wait instead of offering actions", () => {
    renderDetail({ connection: makeConnection("pending", { acceptedAt: null }) });
    expect(
      screen.getByText(/waiting for acme steel to accept/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /accept connection/i })
    ).not.toBeInTheDocument();
  });

  it("accepts an incoming request through the server action", async () => {
    mockAccept.mockResolvedValue({ success: true, data: undefined });
    const user = userEvent.setup();
    renderDetail({ connection: incoming() });

    await user.click(screen.getByRole("button", { name: /accept connection/i }));

    await waitFor(() => {
      expect(mockAccept).toHaveBeenCalledWith("conn-1", "org-1", undefined);
    });
  });

  // ── Reconnecting after rejection / disconnection ─────────────
  it("offers a fresh request on a rejected connection, with the reason", () => {
    renderDetail({
      connection: makeConnection("rejected", {
        acceptedAt: null,
        rejectedAt: new Date("2026-03-01T10:00:00Z"),
        rejectionReason: "Not a supplier we work with",
      }),
    });
    expect(screen.getByText(/request was rejected/i)).toBeInTheDocument();
    expect(
      screen.getByText(/not a supplier we work with/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /send new request/i })
    ).toBeInTheDocument();
  });

  it("sends a new request naming the counterparty as recipient", async () => {
    mockSendRequest.mockResolvedValue({ success: true, data: "conn-2" });
    const user = userEvent.setup();
    renderDetail({
      connection: makeConnection("rejected", {
        acceptedAt: null,
        rejectedAt: new Date("2026-03-01T10:00:00Z"),
      }),
    });

    await user.selectOptions(screen.getByLabelText(/they are my/i), "supplier");
    await user.selectOptions(
      screen.getByLabelText(/linked supplier/i),
      "sup-1"
    );
    await user.click(screen.getByRole("button", { name: /send new request/i }));

    await waitFor(() => {
      expect(mockSendRequest).toHaveBeenCalledTimes(1);
    });
    const formData = mockSendRequest.mock.calls[0]?.[0] as FormData;
    expect(formData.get("requesterOrgId")).toBe("org-1");
    expect(formData.get("recipientOrgId")).toBe("org-2");
    expect(formData.get("counterpartyRole")).toBe("supplier");
    expect(formData.get("linkEntityId")).toBe("sup-1");
  });

  it("offers a fresh request on a disconnected connection", () => {
    renderDetail({
      connection: makeConnection("disconnected", {
        acceptedAt: null,
        disconnectedAt: new Date("2026-04-01T10:00:00Z"),
      }),
    });
    expect(
      screen.getByRole("button", { name: /send new request/i })
    ).toBeInTheDocument();
  });

  it("does not offer a fresh request on an accepted connection", () => {
    renderDetail();
    expect(
      screen.queryByRole("button", { name: /send new request/i })
    ).not.toBeInTheDocument();
  });

  it("removes a dead connection after the user confirms", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockRemove.mockResolvedValue({ success: true, data: undefined });
    const user = userEvent.setup();
    renderDetail({
      connection: makeConnection("rejected", {
        acceptedAt: null,
        rejectedAt: new Date("2026-03-01T10:00:00Z"),
      }),
    });

    await user.click(
      screen.getByRole("button", { name: /remove from network/i })
    );

    await waitFor(() => {
      expect(mockRemove).toHaveBeenCalledWith("conn-1", "org-1");
    });
  });

  it("does not offer removal on an accepted connection", () => {
    renderDetail();
    expect(
      screen.queryByRole("button", { name: /remove from network/i })
    ).not.toBeInTheDocument();
  });

  it("surfaces an error when rejecting fails", async () => {
    mockReject.mockResolvedValue({
      success: false,
      error: { code: "forbidden", message: "Not allowed to reject" },
    });
    const user = userEvent.setup();
    renderDetail({ connection: incoming() });

    await user.click(screen.getByRole("button", { name: /^reject$/i }));

    expect(await screen.findByText(/not allowed to reject/i)).toBeInTheDocument();
  });

  // ── Party linking on accept ──────────────────────────────────
  // The requester declares what we are to them; our role is the inverse.
  const incomingFrom = (role: "customer" | "supplier") =>
    makeConnection("pending", {
      acceptedAt: null,
      requesterOrganizationId: "org-2",
      recipientOrganizationId: "org-1",
      requesterCounterpartyRole: role,
    });

  it("asks for a supplier when the requester called us their customer", () => {
    renderDetail({ connection: incomingFrom("customer") });
    expect(screen.getByLabelText(/which of your suppliers/i)).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/which of your customers/i)
    ).not.toBeInTheDocument();
  });

  it("asks for a customer when the requester called us their supplier", () => {
    renderDetail({ connection: incomingFrom("supplier") });
    expect(screen.getByLabelText(/which of your customers/i)).toBeInTheDocument();
  });

  it("refuses to accept until a party is picked", async () => {
    const user = userEvent.setup();
    renderDetail({ connection: incomingFrom("customer") });

    await user.click(screen.getByRole("button", { name: /accept connection/i }));

    expect(
      await screen.findByText(/select which of your suppliers/i)
    ).toBeInTheDocument();
    expect(mockAccept).not.toHaveBeenCalled();
  });

  it("passes the picked party through to the server action", async () => {
    mockAccept.mockResolvedValue({ success: true, data: undefined });
    const user = userEvent.setup();
    renderDetail({ connection: incomingFrom("customer") });

    await user.selectOptions(
      screen.getByLabelText(/which of your suppliers/i),
      "sup-1"
    );
    await user.click(screen.getByRole("button", { name: /accept connection/i }));

    await waitFor(() => {
      expect(mockAccept).toHaveBeenCalledWith("conn-1", "org-1", "sup-1");
    });
  });

  it("tells the user to add a party first when the book is empty", () => {
    renderDetail({ connection: incomingFrom("customer"), suppliers: [] });
    expect(
      screen.getByText(/you have no unlinked suppliers/i)
    ).toBeInTheDocument();
  });
});
