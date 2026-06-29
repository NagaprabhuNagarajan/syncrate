import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/tests/utils";
import { BusinessProfileCard } from "./BusinessProfileCard";
import type { BusinessSearchResult } from "@/features/cbn/types/cbn.types";

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

describe("BusinessProfileCard", () => {
  it("renders identity, location, GST and a Connect button", () => {
    render(<BusinessProfileCard business={makeBusiness()} />);
    expect(screen.getByText("Acme Steel Works")).toBeInTheDocument();
    expect(screen.getByText("SYN-MH-123456")).toBeInTheDocument();
    expect(screen.getByText("Mumbai, Maharashtra")).toBeInTheDocument();
    expect(screen.getByText("27AABCU9603R1ZM")).toBeInTheDocument();
    expect(screen.getByText("manufacturer")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /connect with acme steel works/i })
    ).toBeInTheDocument();
  });

  it("prefers the displayName over the legal name", () => {
    render(
      <BusinessProfileCard
        business={makeBusiness({ displayName: "Acme" })}
      />
    );
    expect(screen.getByText("Acme")).toBeInTheDocument();
  });

  it("renders a logo image when logoUrl is present", () => {
    render(
      <BusinessProfileCard
        business={makeBusiness({ logoUrl: "https://cdn/logo.png" })}
      />
    );
    const img = screen.getByRole("img", { name: /acme steel works logo/i });
    expect(img).toHaveAttribute("src", "https://cdn/logo.png");
  });

  it("renders initials when no logo is present", () => {
    render(<BusinessProfileCard business={makeBusiness({ logoUrl: null })} />);
    expect(screen.getByText("AS")).toBeInTheDocument();
  });

  it("calls onConnect and hides the Connect button once a request is sent", async () => {
    const onConnect = vi.fn();
    const user = userEvent.setup();
    render(
      <BusinessProfileCard business={makeBusiness()} onConnect={onConnect} />
    );

    await user.click(
      screen.getByRole("button", { name: /connect with acme steel works/i })
    );

    expect(onConnect).toHaveBeenCalledWith("org-2");
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /connect with/i })
      ).not.toBeInTheDocument()
    );
  });

  it("shows a Connected badge when already connected", () => {
    render(
      <BusinessProfileCard business={makeBusiness({ isConnected: true })} />
    );
    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /connect with/i })
    ).not.toBeInTheDocument();
  });

  it("shows a Connected badge when connectionStatus is accepted", () => {
    render(
      <BusinessProfileCard
        business={makeBusiness({ connectionStatus: "accepted" })}
      />
    );
    expect(screen.getByText("Connected")).toBeInTheDocument();
  });

  it("shows a Request Sent badge for a pending connection", () => {
    render(
      <BusinessProfileCard
        business={makeBusiness({ connectionStatus: "pending" })}
      />
    );
    expect(screen.getByText("Request Sent")).toBeInTheDocument();
  });

  it("still allows connecting when the prior request was rejected", () => {
    render(
      <BusinessProfileCard
        business={makeBusiness({ connectionStatus: "rejected" })}
      />
    );
    expect(
      screen.getByRole("button", { name: /connect with/i })
    ).toBeInTheDocument();
  });

  it("omits location and GST rows when those fields are absent", () => {
    render(
      <BusinessProfileCard
        business={makeBusiness({
          city: null,
          state: null,
          gstNumber: null,
          businessType: null,
        })}
      />
    );
    expect(screen.queryByText(/maharashtra/i)).not.toBeInTheDocument();
    expect(screen.queryByText("27AABCU9603R1ZM")).not.toBeInTheDocument();
  });
});
