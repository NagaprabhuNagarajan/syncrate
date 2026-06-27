import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor, within } from "@/tests/utils";
import { ResetPasswordForm } from "./reset-password-form";

// ─────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────

const { mockResetPassword, searchParamsRef } = vi.hoisted(() => ({
  mockResetPassword: vi.fn(),
  searchParamsRef: { current: "" },
}));

vi.mock("@/features/identity/actions/auth.actions", () => ({
  resetPasswordAction: mockResetPassword,
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(searchParamsRef.current),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  searchParamsRef.current = "token=reset-token-123";
});

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("ResetPasswordForm", () => {
  it("renders the heading and password fields", () => {
    render(<ResetPasswordForm />);
    expect(
      screen.getByRole("heading", { name: /set new password/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm new password/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /set new password/i })
    ).toBeInTheDocument();
  });

  it("shows a validation error and does not submit when fields are empty", async () => {
    const user = userEvent.setup();
    render(<ResetPasswordForm />);

    await user.click(
      screen.getByRole("button", { name: /set new password/i })
    );

    expect(
      await screen.findByText(/password must be at least 8 characters/i)
    ).toBeInTheDocument();
    expect(mockResetPassword).not.toHaveBeenCalled();
  });

  it("shows an error when passwords do not match", async () => {
    const user = userEvent.setup();
    render(<ResetPasswordForm />);

    await user.type(screen.getByLabelText("New password"), "Password1");
    await user.type(
      screen.getByLabelText(/confirm new password/i),
      "Password2"
    );
    await user.click(
      screen.getByRole("button", { name: /set new password/i })
    );

    expect(
      await screen.findByText(/passwords do not match/i)
    ).toBeInTheDocument();
    expect(mockResetPassword).not.toHaveBeenCalled();
  });

  it("submits the action with the token from the URL when valid", async () => {
    mockResetPassword.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<ResetPasswordForm />);

    await user.type(screen.getByLabelText("New password"), "Password1");
    await user.type(
      screen.getByLabelText(/confirm new password/i),
      "Password1"
    );
    await user.click(
      screen.getByRole("button", { name: /set new password/i })
    );

    await waitFor(() => expect(mockResetPassword).toHaveBeenCalledTimes(1));
    const formData = mockResetPassword.mock.calls[0]?.[0] as FormData;
    expect(formData.get("password")).toBe("Password1");
    expect(formData.get("confirmPassword")).toBe("Password1");
    expect(formData.get("token")).toBe("reset-token-123");
  });

  it("submits an empty token when none is present in the URL", async () => {
    searchParamsRef.current = "";
    mockResetPassword.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<ResetPasswordForm />);

    await user.type(screen.getByLabelText("New password"), "Password1");
    await user.type(
      screen.getByLabelText(/confirm new password/i),
      "Password1"
    );
    await user.click(
      screen.getByRole("button", { name: /set new password/i })
    );

    await waitFor(() => expect(mockResetPassword).toHaveBeenCalledTimes(1));
    const formData = mockResetPassword.mock.calls[0]?.[0] as FormData;
    expect(formData.get("token")).toBe("");
  });

  it("displays a server error returned by the action", async () => {
    mockResetPassword.mockResolvedValue({
      success: false,
      error: { code: "invalid_token", message: "Reset link has expired" },
    });
    const user = userEvent.setup();
    render(<ResetPasswordForm />);

    await user.type(screen.getByLabelText("New password"), "Password1");
    await user.type(
      screen.getByLabelText(/confirm new password/i),
      "Password1"
    );
    await user.click(
      screen.getByRole("button", { name: /set new password/i })
    );

    expect(
      await screen.findByText(/reset link has expired/i)
    ).toBeInTheDocument();
  });

  it("toggles visibility for both password fields", async () => {
    const user = userEvent.setup();
    render(<ResetPasswordForm />);

    const password = screen.getByLabelText("New password");
    const confirm = screen.getByLabelText(/confirm new password/i);
    expect(password).toHaveAttribute("type", "password");
    expect(confirm).toHaveAttribute("type", "password");

    const pwWrapper = password.parentElement as HTMLElement;
    const confirmWrapper = confirm.parentElement as HTMLElement;

    await user.click(
      within(pwWrapper).getByRole("button", { name: /show password/i })
    );
    expect(password).toHaveAttribute("type", "text");
    await user.click(
      within(pwWrapper).getByRole("button", { name: /hide password/i })
    );
    expect(password).toHaveAttribute("type", "password");

    await user.click(
      within(confirmWrapper).getByRole("button", { name: /show password/i })
    );
    expect(confirm).toHaveAttribute("type", "text");
  });
});
