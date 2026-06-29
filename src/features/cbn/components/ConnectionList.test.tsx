import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/tests/utils";
import { ConnectionList } from "./ConnectionList";
import type {
  BusinessConnection,
  ConnectionStatus,
} from "@/features/cbn/types/cbn.types";

const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: vi.fn() }),
}));

// AnimatePresence mode="wait" keeps exiting elements mounted in happy-dom,
// so stub framer-motion to render children directly without animation.
vi.mock("framer-motion", () => {
  const MOTION_PROPS = new Set([
    "initial",
    "animate",
    "exit",
    "transition",
    "whileHover",
    "whileTap",
    "layout",
    "variants",
  ]);
  const filterProps = (props: Record<string, unknown>) =>
    Object.fromEntries(
      Object.entries(props).filter(([key]) => !MOTION_PROPS.has(key))
    );
  const motion = new Proxy(
    {},
    {
      get: (_target, tag: string) =>
        function MotionStub({
          children,
          ...props
        }: { children?: ReactNode } & Record<string, unknown>) {
          return createElement(tag, filterProps(props), children);
        },
    }
  );
  return {
    motion,
    AnimatePresence: ({ children }: { children?: ReactNode }) => children,
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

function makeConnection(
  id: string,
  status: ConnectionStatus,
  overrides: Partial<BusinessConnection> = {}
): BusinessConnection {
  return {
    id,
    organizationId: "org-1",
    requesterOrganizationId: "org-1",
    recipientOrganizationId: "org-2",
    status,
    connectionMessage: null,
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

const orgNames = {
  "org-2": { name: "Acme Steel", businessId: "SYN-MH-123456" },
  "org-3": { name: "Beta Traders" },
};

describe("ConnectionList", () => {
  it("renders all connections by default with counts", () => {
    render(
      <ConnectionList
        connections={[
          makeConnection("c1", "accepted"),
          makeConnection("c2", "pending", { recipientOrganizationId: "org-3" }),
        ]}
        myOrgId="org-1"
        orgNames={orgNames}
      />
    );
    expect(screen.getByText("Acme Steel")).toBeInTheDocument();
    expect(screen.getByText("Beta Traders")).toBeInTheDocument();
    const allTab = screen.getByRole("tab", { name: /all/i });
    expect(allTab).toHaveAttribute("aria-selected", "true");
  });

  it("filters connections when a status tab is selected", async () => {
    const user = userEvent.setup();
    render(
      <ConnectionList
        connections={[
          makeConnection("c1", "accepted"),
          makeConnection("c2", "pending", { recipientOrganizationId: "org-3" }),
        ]}
        myOrgId="org-1"
        orgNames={orgNames}
      />
    );

    await user.click(screen.getByRole("tab", { name: /pending/i }));

    expect(screen.getByText("Beta Traders")).toBeInTheDocument();
    expect(screen.queryByText("Acme Steel")).not.toBeInTheDocument();
  });

  it("resolves the other org name from the requester side when I am the recipient", () => {
    render(
      <ConnectionList
        connections={[
          makeConnection("c1", "accepted", {
            requesterOrganizationId: "org-2",
            recipientOrganizationId: "org-1",
          }),
        ]}
        myOrgId="org-1"
        orgNames={orgNames}
      />
    );
    expect(screen.getByText("Acme Steel")).toBeInTheDocument();
  });

  it("falls back to the org id when no name mapping exists", () => {
    render(
      <ConnectionList
        connections={[
          makeConnection("c1", "accepted", {
            recipientOrganizationId: "org-unknown",
          }),
        ]}
        myOrgId="org-1"
        orgNames={orgNames}
      />
    );
    expect(screen.getByText("org-unknown")).toBeInTheDocument();
  });

  it("renders the all-tab empty state with a discover action", async () => {
    const user = userEvent.setup();
    render(
      <ConnectionList connections={[]} myOrgId="org-1" orgNames={{}} />
    );
    expect(screen.getByText(/no connections yet/i)).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /discover businesses/i })
    );
    expect(mockPush).toHaveBeenCalledWith("/cbn/discover");
  });

  it("renders a tab-specific empty state without an action", async () => {
    const user = userEvent.setup();
    render(
      <ConnectionList
        connections={[makeConnection("c1", "accepted")]}
        myOrgId="org-1"
        orgNames={orgNames}
      />
    );
    await user.click(screen.getByRole("tab", { name: /rejected/i }));
    expect(screen.getByText(/no rejected connections/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /discover businesses/i })
    ).not.toBeInTheDocument();
  });

  it("navigates to discover via the footer CTA when there are connections", async () => {
    const user = userEvent.setup();
    render(
      <ConnectionList
        connections={[makeConnection("c1", "accepted")]}
        myOrgId="org-1"
        orgNames={orgNames}
      />
    );
    await user.click(
      screen.getByRole("button", { name: /discover more businesses/i })
    );
    expect(mockPush).toHaveBeenCalledWith("/cbn/discover");
  });
});
