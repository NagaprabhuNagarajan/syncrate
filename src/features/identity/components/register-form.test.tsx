import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor, within } from "@/tests/utils";
import { RegisterForm, RegistrationSuccess } from "./register-form";

// ─────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────

const { mockSignUp } = vi.hoisted(() => ({
  mockSignUp: vi.fn(),
}));

vi.mock("@/features/identity/actions/auth.actions", () => ({
  signUpAction: mockSignUp,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/full name/i), "Priya Sharma");
  await user.type(screen.getByLabelText(/work email/i), "priya@company.com");
  await user.type(screen.getByLabelText("Password"), "Password1");
  await user.type(screen.getByLabelText(/confirm password/i), "Password1");
  await user.click(screen.getByLabelText(/i agree to the/i));
}

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("RegisterForm", () => {
  it("renders the heading and primary fields", () => {
    render(<RegisterForm />);
    expect(
      screen.getByRole("heading", { name: /create your account/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/work email/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create account/i })
    ).toBeInTheDocument();
  });

  it("shows validation errors and does not submit when fields are empty", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it("shows the password strength indicator as the user types", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText("Password"), "Password1");

    expect(screen.getByText(/password strength/i)).toBeInTheDocument();
    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
  });

  it("calls signUpAction with form values when every field is valid", async () => {
    // Verifies the fix for the acceptTerms checkbox: removing value="on"
    // makes RHF store boolean true, satisfying z.literal(true) in the schema.
    mockSignUp.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<RegisterForm />);

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(mockSignUp).toHaveBeenCalledTimes(1));
    const fd = mockSignUp.mock.calls[0]?.[0] as FormData;
    expect(fd.get("email")).toBe("priya@company.com");
    expect(fd.get("fullName")).toBe("Priya Sharma");
    // acceptTerms is always appended as "on" in the onSubmit handler.
    expect(fd.get("acceptTerms")).toBe("on");
  });

  it("displays a server error returned by the action", async () => {
    mockSignUp.mockResolvedValue({
      success: false,
      error: { code: "email_already_registered", message: "Email already in use" },
    });
    const user = userEvent.setup();
    render(<RegisterForm />);

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText(/email already in use/i)).toBeInTheDocument();
  });

  it("shows a passwords-do-not-match error when confirm differs from password", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText(/full name/i), "Priya Sharma");
    await user.type(screen.getByLabelText(/work email/i), "priya@company.com");
    await user.type(screen.getByLabelText("Password"), "Password1");
    await user.type(screen.getByLabelText(/confirm password/i), "Different1");
    await user.click(screen.getByLabelText(/i agree to the/i));
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(
      await screen.findByText(/passwords do not match/i)
    ).toBeInTheDocument();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it("toggles password visibility for both password fields", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    const password = screen.getByLabelText("Password");
    const confirm = screen.getByLabelText(/confirm password/i);
    expect(password).toHaveAttribute("type", "password");
    expect(confirm).toHaveAttribute("type", "password");

    // Each input shares a relative wrapper with its own toggle button.
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

describe("RegistrationSuccess", () => {
  it("renders the check-your-email success state", () => {
    render(<RegistrationSuccess />);
    expect(
      screen.getByRole("heading", { name: /check your email/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/verification link/i)).toBeInTheDocument();
  });
});
