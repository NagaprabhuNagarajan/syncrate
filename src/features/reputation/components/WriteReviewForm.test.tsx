import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/tests/utils";
import { WriteReviewForm } from "./WriteReviewForm";

// ─────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────

const { mockPost, mockUpdate, mockRefresh } = vi.hoisted(() => ({
  mockPost: vi.fn(),
  mockUpdate: vi.fn(),
  mockRefresh: vi.fn(),
}));

vi.mock("@/features/reputation/actions/reputation.actions", () => ({
  postReviewAction: mockPost,
  updateReviewAction: mockUpdate,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: mockRefresh }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const SUBJECT = "11111111-1111-1111-1111-111111111111";

describe("WriteReviewForm", () => {
  it("renders the rating selector and recommend toggle", () => {
    render(
      <WriteReviewForm
        organizationId="org-reviewer"
        subjectOrganizationId={SUBJECT}
        subjectName="Acme Traders"
      />
    );

    expect(screen.getByText("Review Acme Traders")).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: /rating/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /i recommend this business/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /submit review/i })
    ).toBeInTheDocument();
  });

  it("blocks submission until a rating is chosen", async () => {
    const user = userEvent.setup();
    render(
      <WriteReviewForm
        organizationId="org-reviewer"
        subjectOrganizationId={SUBJECT}
        subjectName="Acme Traders"
      />
    );

    await user.click(screen.getByRole("button", { name: /submit review/i }));

    expect(mockPost).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("submits a valid new review", async () => {
    mockPost.mockResolvedValue({ success: true, data: { id: "review-1" } });
    const onSuccess = vi.fn();
    const user = userEvent.setup();

    render(
      <WriteReviewForm
        organizationId="org-reviewer"
        subjectOrganizationId={SUBJECT}
        subjectName="Acme Traders"
        onSuccess={onSuccess}
      />
    );

    await user.click(screen.getByRole("button", { name: /rate 5 stars/i }));
    await user.click(screen.getByRole("button", { name: /submit review/i }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledTimes(1);
    });

    const [orgId, formData] = mockPost.mock.calls[0];
    expect(orgId).toBe("org-reviewer");
    expect(formData.get("rating")).toBe("5");
    expect(formData.get("subjectOrganizationId")).toBe(SUBJECT);
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it("surfaces a server error", async () => {
    mockPost.mockResolvedValue({
      success: false,
      error: { code: "conflict", message: "Already reviewed" },
    });
    const user = userEvent.setup();

    render(
      <WriteReviewForm
        organizationId="org-reviewer"
        subjectOrganizationId={SUBJECT}
        subjectName="Acme Traders"
      />
    );

    await user.click(screen.getByRole("button", { name: /rate 4 stars/i }));
    await user.click(screen.getByRole("button", { name: /submit review/i }));

    expect(await screen.findByText("Already reviewed")).toBeInTheDocument();
  });
});
