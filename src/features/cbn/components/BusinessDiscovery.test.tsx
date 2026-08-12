import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/tests/utils";
import { BusinessDiscovery } from "./BusinessDiscovery";
import type { BusinessSearchResult } from "@/features/cbn/types/cbn.types";

interface DiscoveryState {
  data?: BusinessSearchResult[];
  isLoading: boolean;
  isError: boolean;
}

const { discoveryRef, mockSend } = vi.hoisted(() => ({
  discoveryRef: {
    current: { isLoading: false, isError: false } as DiscoveryState,
  },
  mockSend: vi.fn(),
}));

vi.mock("@/features/cbn/hooks/useBusinessDiscovery", () => ({
  useBusinessDiscovery: () => discoveryRef.current,
}));

vi.mock("@/features/cbn/actions/connection.actions", () => ({
  sendConnectionRequest: mockSend,
}));

beforeEach(() => {
  vi.clearAllMocks();
  discoveryRef.current = { data: [], isLoading: false, isError: false };
});

function makeBusiness(
  overrides: Partial<BusinessSearchResult> = {}
): BusinessSearchResult {
  return {
    id: "org-2",
    name: "Acme Steel Works",
    displayName: null,
    businessId: "SYN-MH-123456",
    gstNumber: "27AABCU9603R1ZM",
    businessType: "manufacturer",
    city: "Mumbai",
    state: "Maharashtra",
    country: "IN",
    logoUrl: null,
    verificationStatus: "verified",
    verificationLevel: 3,
    trustScore: 82,
    isConnected: false,
    connectionStatus: null,
    ...overrides,
  };
}

describe("BusinessDiscovery", () => {
  it("shows the prompt to start searching when the query is short", () => {
    render(<BusinessDiscovery organizationId="org-1" />);
    expect(
      screen.getByText(/search the business network/i)
    ).toBeInTheDocument();
  });

  it("renders result cards returned by the discovery hook", () => {
    discoveryRef.current = {
      data: [makeBusiness()],
      isLoading: false,
      isError: false,
    };
    render(<BusinessDiscovery organizationId="org-1" />);
    expect(screen.getByText("Acme Steel Works")).toBeInTheDocument();
  });

  it("shows a loading spinner while searching with a valid query", async () => {
    discoveryRef.current = { data: [], isLoading: true, isError: false };
    const user = userEvent.setup();
    render(<BusinessDiscovery organizationId="org-1" />);

    await user.type(screen.getByLabelText(/search businesses/i), "acme");

    expect(
      await screen.findByRole("status", { name: /searching businesses/i })
    ).toBeInTheDocument();
  });

  it("shows an error banner when the search fails", () => {
    discoveryRef.current = { data: [], isLoading: false, isError: true };
    render(<BusinessDiscovery organizationId="org-1" />);
    expect(
      screen.getByText(/failed to search businesses/i)
    ).toBeInTheDocument();
  });

  it("shows an empty state when no businesses match", async () => {
    discoveryRef.current = { data: [], isLoading: false, isError: false };
    const user = userEvent.setup();
    render(<BusinessDiscovery organizationId="org-1" />);

    await user.type(screen.getByLabelText(/search businesses/i), "zzz");

    expect(
      await screen.findByText(/no businesses found/i)
    ).toBeInTheDocument();
  });

  it("filters to verified businesses only when the checkbox is toggled", async () => {
    discoveryRef.current = {
      data: [
        makeBusiness({ id: "org-2", name: "Verified Co", verificationLevel: 4 }),
        makeBusiness({
          id: "org-3",
          name: "Unverified Co",
          verificationLevel: 1,
        }),
      ],
      isLoading: false,
      isError: false,
    };
    const user = userEvent.setup();
    render(<BusinessDiscovery organizationId="org-1" />);

    expect(screen.getByText("Unverified Co")).toBeInTheDocument();
    await user.click(screen.getByLabelText(/verified only/i));

    expect(screen.getByText("Verified Co")).toBeInTheDocument();
    expect(screen.queryByText("Unverified Co")).not.toBeInTheDocument();
  });

  it("opens the connection request dialog when a card's Connect is clicked", async () => {
    discoveryRef.current = {
      data: [makeBusiness({ displayName: "Acme" })],
      isLoading: false,
      isError: false,
    };
    const user = userEvent.setup();
    render(<BusinessDiscovery organizationId="org-1" />);

    await user.click(screen.getByRole("button", { name: /connect with/i }));

    expect(
      await screen.findByRole("heading", { name: /connect with acme/i })
    ).toBeInTheDocument();
  });

  it("closes the dialog after a successful connection request", async () => {
    mockSend.mockResolvedValue({ success: true, data: "conn-1" });
    discoveryRef.current = {
      data: [makeBusiness({ displayName: "Acme" })],
      isLoading: false,
      isError: false,
    };
    const user = userEvent.setup();
    render(
      <BusinessDiscovery
        organizationId="org-1"
        suppliers={[{ id: "sup-1", code: "SUP-001", name: "Acme Steel Co" }]}
      />
    );

    await user.click(screen.getByRole("button", { name: /connect with/i }));
    // The relationship and the local record are both mandatory now.
    await user.click(await screen.findByRole("button", { name: /^supplier/i }));
    await user.selectOptions(
      screen.getByLabelText(/which of your suppliers/i),
      "sup-1"
    );
    await user.click(
      await screen.findByRole("button", { name: /send request/i })
    );

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
  });
});
