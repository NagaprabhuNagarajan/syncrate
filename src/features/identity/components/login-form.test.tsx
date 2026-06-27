import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/tests/utils";
import { LoginForm } from "./login-form";

// ─────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────

const { mockSignIn, searchParamsRef } = vi.hoisted(() => ({
  mockSignIn: vi.fn(),
  searchParamsRef: { current: "" },
}));

vi.mock("@/features/identity/actions/auth.actions", () => ({
  signInAction: mockSignIn,
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(searchParamsRef.current),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  searchParamsRef.current = "";
});

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("LoginForm", () => {
  it("renders the heading and primary fields", () => {
    render(<LoginForm />);
    expect(
      screen.getByRole("heading", { name: /welcome back/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("shows a validation error and does not submit when fields are empty", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("submits the action with the entered credentials when valid", async () => {
    mockSignIn.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email address/i), "user@example.com");
    await user.type(screen.getByLabelText("Password"), "Password1");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(mockSignIn).toHaveBeenCalledTimes(1));
    const formData = mockSignIn.mock.calls[0]?.[0] as FormData;
    expect(formData.get("email")).toBe("user@example.com");
    expect(formData.get("password")).toBe("Password1");
    expect(formData.get("redirectTo")).toBe("/dashboard");
  });

  it("displays a server error returned by the action", async () => {
    mockSignIn.mockResolvedValue({
      success: false,
      error: { code: "invalid_credentials", message: "Invalid email or password" },
    });
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email address/i), "user@example.com");
    await user.type(screen.getByLabelText("Password"), "Password1");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(
      await screen.findByText(/invalid email or password/i)
    ).toBeInTheDocument();
  });

  it("toggles password visibility", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    const password = screen.getByLabelText("Password");
    expect(password).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: /show password/i }));
    expect(password).toHaveAttribute("type", "text");

    await user.click(screen.getByRole("button", { name: /hide password/i }));
    expect(password).toHaveAttribute("type", "password");
  });

  it("honors a redirectTo query param when submitting", async () => {
    searchParamsRef.current = "redirectTo=/settings";
    mockSignIn.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email address/i), "user@example.com");
    await user.type(screen.getByLabelText("Password"), "Password1");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(mockSignIn).toHaveBeenCalledTimes(1));
    const formData = mockSignIn.mock.calls[0]?.[0] as FormData;
    expect(formData.get("redirectTo")).toBe("/settings");
  });

  it("shows the password-reset success message from the query param", () => {
    searchParamsRef.current = "message=password-reset";
    render(<LoginForm />);
    expect(
      screen.getByText(/your password has been reset/i)
    ).toBeInTheDocument();
  });
});
