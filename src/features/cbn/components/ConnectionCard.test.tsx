import { describe, expect, it } from "vitest";
import { render, screen } from "@/tests/utils";
import { ConnectionCard } from "./ConnectionCard";
import type { BusinessConnection } from "@/features/cbn/types/cbn.types";

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
});
