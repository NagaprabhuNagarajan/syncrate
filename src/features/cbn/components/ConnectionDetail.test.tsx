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

const { mockUpdatePermissions, mockDisconnect } = vi.hoisted(() => ({
  mockUpdatePermissions: vi.fn(),
  mockDisconnect: vi.fn(),
}));

vi.mock("@/features/cbn/actions/connection.actions", () => ({
  updateConnectionPermissions: mockUpdatePermissions,
  disconnectBusiness: mockDisconnect,
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
});
