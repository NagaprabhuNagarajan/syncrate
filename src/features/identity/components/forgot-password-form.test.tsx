import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/tests/utils";
import { ForgotPasswordForm } from "./forgot-password-form";

// ─────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────

const { mockForgotPassword } = vi.hoisted(() => ({
  mockForgotPassword: vi.fn(),
}));

vi.mock("@/features/identity/actions/auth.actions", () => ({
  forgotPasswordAction: mockForgotPassword,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("ForgotPasswordForm", () => {
  it("renders the heading and email field", () => {
    render(<ForgotPasswordForm />);
    expect(
      screen.getByRole("heading", { name: /reset your password/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /send reset link/i })
    ).toBeInTheDocument();
  });

  it("shows a validation error and does not submit when email is empty", async () => {
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.click(screen.getByRole("button", { name: /send reset link/i }));

    expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
    expect(mockForgotPassword).not.toHaveBeenCalled();
  });

  it("shows a validation error for an invalid email", async () => {
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText(/email address/i), "not-an-email");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));

    expect(
      await screen.findByText(/please enter a valid email address/i)
    ).toBeInTheDocument();
    expect(mockForgotPassword).not.toHaveBeenCalled();
  });

  it("submits the action with the entered email and shows the success state", async () => {
    mockForgotPassword.mockResolvedValue({ success: true, data: undefined });
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText(/email address/i), "user@example.com");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() =>
      expect(mockForgotPassword).toHaveBeenCalledTimes(1)
    );
    const formData = mockForgotPassword.mock.calls[0]?.[0] as FormData;
    expect(formData.get("email")).toBe("user@example.com");

    expect(
      await screen.findByRole("heading", { name: /check your inbox/i })
    ).toBeInTheDocument();
    expect(screen.getByText("user@example.com")).toBeInTheDocument();
  });

  it("displays a server error returned by the action", async () => {
    mockForgotPassword.mockResolvedValue({
      success: false,
      error: { code: "rate_limited", message: "Too many requests" },
    });
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText(/email address/i), "user@example.com");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));

    expect(await screen.findByText(/too many requests/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /check your inbox/i })
    ).not.toBeInTheDocument();
  });
});
