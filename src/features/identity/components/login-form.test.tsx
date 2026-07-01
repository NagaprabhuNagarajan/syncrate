import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/tests/utils";
import { LoginForm } from "./login-form";

// ─────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────

const { mockRequestOtp, mockVerifyOtp, searchParamsRef } = vi.hoisted(() => ({
  mockRequestOtp: vi.fn(),
  mockVerifyOtp: vi.fn(),
  searchParamsRef: { current: "" },
}));

vi.mock("@/features/identity/actions/auth.actions", () => ({
  requestOtpAction: mockRequestOtp,
  verifyOtpAction: mockVerifyOtp,
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
// Helper — advance from the email step to the code step
// ─────────────────────────────────────────────────────────────

async function reachCodeStep(
  user: ReturnType<typeof userEvent.setup>,
  email = "user@example.com"
) {
  mockRequestOtp.mockResolvedValue({ success: true, data: undefined });
  await user.type(screen.getByLabelText(/email address/i), email);
  await user.click(screen.getByRole("button", { name: /send login code/i }));
  await screen.findByRole("heading", { name: /check your email/i });
}

// ─────────────────────────────────────────────────────────────
// Step 1 — email entry
// ─────────────────────────────────────────────────────────────

describe("LoginForm — email step", () => {
  it("renders the passwordless heading and email field (no password field)", () => {
    render(<LoginForm />);
    expect(
      screen.getByRole("heading", { name: /welcome to syncrate/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /send login code/i })
    ).toBeInTheDocument();
  });

  it("shows a validation error and does not submit when the email is empty", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.click(screen.getByRole("button", { name: /send login code/i }));

    expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
    expect(mockRequestOtp).not.toHaveBeenCalled();
  });

  it("requests a code with the entered email and advances to the code step", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await reachCodeStep(user, "USER@Example.com");

    expect(mockRequestOtp).toHaveBeenCalledTimes(1);
    const formData = mockRequestOtp.mock.calls[0]?.[0] as FormData;
    // zodResolver normalizes the email to lowercase before submit.
    expect(formData.get("email")).toBe("user@example.com");
  });

  it("displays a server error returned by the request action", async () => {
    mockRequestOtp.mockResolvedValue({
      success: false,
      error: { code: "too_many_requests", message: "Please wait a minute" },
    });
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email address/i), "user@example.com");
    await user.click(screen.getByRole("button", { name: /send login code/i }));

    expect(await screen.findByText(/please wait a minute/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
// Step 2 — code entry
// ─────────────────────────────────────────────────────────────

describe("LoginForm — code step", () => {
  it("shows the target email and a code field", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    await reachCodeStep(user);

    expect(screen.getByText("user@example.com")).toBeInTheDocument();
    expect(screen.getByLabelText(/login code/i)).toBeInTheDocument();
  });

  it("auto-submits verification once a 6-digit code is entered", async () => {
    mockVerifyOtp.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<LoginForm />);
    await reachCodeStep(user);

    await user.type(screen.getByLabelText(/login code/i), "123456");

    await waitFor(() => expect(mockVerifyOtp).toHaveBeenCalledTimes(1));
    const formData = mockVerifyOtp.mock.calls[0]?.[0] as FormData;
    expect(formData.get("email")).toBe("user@example.com");
    expect(formData.get("token")).toBe("123456");
    expect(formData.get("redirectTo")).toBe("/dashboard");
  });

  it("honors a redirectTo query param on verification", async () => {
    searchParamsRef.current = "redirectTo=/settings";
    mockVerifyOtp.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<LoginForm />);
    await reachCodeStep(user);

    await user.type(screen.getByLabelText(/login code/i), "654321");

    await waitFor(() => expect(mockVerifyOtp).toHaveBeenCalledTimes(1));
    const formData = mockVerifyOtp.mock.calls[0]?.[0] as FormData;
    expect(formData.get("redirectTo")).toBe("/settings");
  });

  it("displays a server error returned by the verify action", async () => {
    mockVerifyOtp.mockResolvedValue({
      success: false,
      error: { code: "otp_invalid", message: "That code isn't valid" },
    });
    const user = userEvent.setup();
    render(<LoginForm />);
    await reachCodeStep(user);

    await user.type(screen.getByLabelText(/login code/i), "000000");

    expect(await screen.findByText(/that code isn't valid/i)).toBeInTheDocument();
  });

  it("returns to the email step via 'Change email'", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    await reachCodeStep(user);

    await user.click(screen.getByRole("button", { name: /change email/i }));

    expect(
      await screen.findByRole("heading", { name: /welcome to syncrate/i })
    ).toBeInTheDocument();
  });

  it("resends a code from the code step", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    await reachCodeStep(user);

    mockRequestOtp.mockResolvedValue({ success: true, data: undefined });
    await user.click(screen.getByRole("button", { name: /resend code/i }));

    await waitFor(() => expect(mockRequestOtp).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/new code is on its way/i)).toBeInTheDocument();
  });
});
