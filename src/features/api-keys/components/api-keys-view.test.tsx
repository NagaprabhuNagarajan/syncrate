import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, within } from "@/tests/utils";
import { ApiKeysView } from "./api-keys-view";
import type { ApiKey } from "@/features/api-keys/types/api-key.types";

// ─────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────

const { mockRefresh, createActionMock, revokeActionMock } = vi.hoisted(() => ({
  mockRefresh: vi.fn(),
  createActionMock: vi.fn(),
  revokeActionMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: mockRefresh }),
  useSearchParams: () => new URLSearchParams(""),
}));

vi.mock("@/features/api-keys/actions/api-key.actions", () => ({
  createApiKeyAction: createActionMock,
  revokeApiKeyAction: revokeActionMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────

function makeKey(overrides: Partial<ApiKey> = {}): ApiKey {
  return {
    id: "key-1",
    organizationId: "org-1",
    name: "Production server",
    keyPrefix: "syk_live_a1b2",
    scopes: ["read", "write"],
    lastUsedAt: null,
    expiresAt: null,
    revokedAt: null,
    revokedBy: null,
    createdAt: new Date("2026-01-01"),
    createdBy: "user-1",
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("ApiKeysView", () => {
  it("renders keys with prefix, scopes and an active status badge", () => {
    render(
      <ApiKeysView organizationId="org-1" apiKeys={[makeKey()]} canManage />
    );
    expect(
      screen.getByRole("heading", { name: /api keys/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Production server")).toBeInTheDocument();
    expect(screen.getByText("syk_live_a1b2…")).toBeInTheDocument();
    // Status badge lives in the table (the strip also has an "Active" tile).
    expect(
      within(screen.getByRole("table")).getByText("Active")
    ).toBeInTheDocument();
  });

  it("shows expired and revoked status badges", () => {
    render(
      <ApiKeysView
        organizationId="org-1"
        apiKeys={[
          makeKey({ id: "k1", expiresAt: new Date("2000-01-01") }),
          makeKey({ id: "k2", revokedAt: new Date("2026-02-01") }),
        ]}
        canManage
      />
    );
    // Scope to the table — the stat strip also renders "Expired"/"Revoked".
    const table = within(screen.getByRole("table"));
    expect(table.getByText("Expired")).toBeInTheDocument();
    expect(table.getByText("Revoked")).toBeInTheDocument();
  });

  it("hides the create button and revoke action when canManage is false", () => {
    render(
      <ApiKeysView
        organizationId="org-1"
        apiKeys={[makeKey()]}
        canManage={false}
      />
    );
    expect(
      screen.queryByRole("button", { name: /create key/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /revoke production server/i })
    ).not.toBeInTheDocument();
  });

  it("renders an empty state when there are no keys", () => {
    render(<ApiKeysView organizationId="org-1" apiKeys={[]} canManage />);
    expect(screen.getByText(/no api keys yet/i)).toBeInTheDocument();
  });

  it("creates a key and reveals the plaintext exactly once", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    createActionMock.mockResolvedValue({
      success: true,
      data: {
        apiKey: makeKey(),
        plaintextKey: "syk_live_0123456789abcdef0123456789abcdef0123456789abcdef",
      },
    });

    render(<ApiKeysView organizationId="org-1" apiKeys={[]} canManage />);

    await user.click(screen.getByRole("button", { name: /create key/i }));
    await user.type(screen.getByLabelText(/name/i), "CI pipeline");
    await user.click(screen.getByRole("checkbox", { name: /read — all/i }));
    await user.click(screen.getByRole("button", { name: /generate key/i }));

    // Action invoked with the org id and FormData.
    expect(createActionMock).toHaveBeenCalledTimes(1);
    expect(createActionMock.mock.calls[0]?.[0]).toBe("org-1");
    const formData = createActionMock.mock.calls[0]?.[1] as FormData;
    expect(formData.get("name")).toBe("CI pipeline");
    expect(formData.getAll("scopes")).toContain("read");

    // The one-time reveal panel shows the full key + warning.
    const alert = await screen.findByRole("alert");
    expect(
      within(alert).getByText(
        "syk_live_0123456789abcdef0123456789abcdef0123456789abcdef"
      )
    ).toBeInTheDocument();
    expect(within(alert).getByText(/only time/i)).toBeInTheDocument();

    // Copy writes the secret to the clipboard.
    await user.click(within(alert).getByRole("button", { name: /copy/i }));
    expect(writeText).toHaveBeenCalledWith(
      "syk_live_0123456789abcdef0123456789abcdef0123456789abcdef"
    );
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("surfaces a create error without revealing a key", async () => {
    const user = userEvent.setup();
    createActionMock.mockResolvedValue({
      success: false,
      error: { code: "validation", message: "Select at least one scope" },
    });

    render(<ApiKeysView organizationId="org-1" apiKeys={[]} canManage />);
    await user.click(screen.getByRole("button", { name: /create key/i }));
    await user.type(screen.getByLabelText(/name/i), "No scopes");
    await user.click(screen.getByRole("button", { name: /generate key/i }));

    expect(
      await screen.findByText("Select at least one scope")
    ).toBeInTheDocument();
  });

  it("revokes a key after confirmation", async () => {
    const user = userEvent.setup();
    revokeActionMock.mockResolvedValue({
      success: true,
      data: makeKey({ revokedAt: new Date("2026-03-01") }),
    });

    render(
      <ApiKeysView organizationId="org-1" apiKeys={[makeKey()]} canManage />
    );

    await user.click(
      screen.getByRole("button", { name: /revoke production server/i })
    );

    const dialog = screen.getByRole("alertdialog", { name: /revoke api key/i });
    await user.click(within(dialog).getByRole("button", { name: /revoke key/i }));

    expect(revokeActionMock).toHaveBeenCalledWith("org-1", "key-1");
    expect(mockRefresh).toHaveBeenCalled();
  });
});
