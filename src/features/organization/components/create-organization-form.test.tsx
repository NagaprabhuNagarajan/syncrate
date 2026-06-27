import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/tests/utils";
import { CreateOrganizationForm } from "./create-organization-form";

// ─────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────

const { mockCreateOrganization } = vi.hoisted(() => ({
  mockCreateOrganization: vi.fn(),
}));

vi.mock("@/features/organization/actions/organization.actions", () => ({
  createOrganizationAction: mockCreateOrganization,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("CreateOrganizationForm", () => {
  it("renders the heading and primary fields", () => {
    render(<CreateOrganizationForm />);

    expect(
      screen.getByRole("heading", { name: /set up your organization/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/organization name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/business type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/gst number/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /continue/i })
    ).toBeInTheDocument();
  });

  it("renders the optional contact and address fields", () => {
    render(<CreateOrganizationForm />);

    expect(screen.getByLabelText(/phone/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/business email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/city/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/state/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/pincode/i)).toBeInTheDocument();
  });

  it("shows a validation error and does not submit when the name is too short", async () => {
    const user = userEvent.setup();
    render(<CreateOrganizationForm />);

    await user.type(screen.getByLabelText(/organization name/i), "A");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    expect(
      await screen.findByText(/name must be at least 2 characters/i)
    ).toBeInTheDocument();
    expect(mockCreateOrganization).not.toHaveBeenCalled();
  });

  it("shows a validation error for an invalid GST number", async () => {
    const user = userEvent.setup();
    render(<CreateOrganizationForm />);

    await user.type(
      screen.getByLabelText(/organization name/i),
      "Sharma Enterprises"
    );
    await user.type(screen.getByLabelText(/gst number/i), "INVALID");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    expect(
      await screen.findByText(/invalid gst number format/i)
    ).toBeInTheDocument();
    expect(mockCreateOrganization).not.toHaveBeenCalled();
  });

  it("submits successfully without a business type (field is truly optional)", async () => {
    // businessType schema now accepts "" (the HTML select default) via
    // .or(z.literal("")). The form strips empty strings from the FormData
    // payload, so businessType must be absent when left unselected.
    mockCreateOrganization.mockResolvedValue({
      success: true,
      data: { id: "org-1" },
    });
    const user = userEvent.setup();
    render(<CreateOrganizationForm />);

    await user.type(
      screen.getByLabelText(/organization name/i),
      "Sharma Enterprises"
    );
    // Deliberately do NOT select a business type.
    await user.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() =>
      expect(mockCreateOrganization).toHaveBeenCalledTimes(1)
    );
    const formData = mockCreateOrganization.mock.calls[0]?.[0] as FormData;
    expect(formData.get("name")).toBe("Sharma Enterprises");
    // Empty businessType must be omitted (not sent as "") to the action.
    expect(formData.get("businessType")).toBeNull();
  });

  it("submits the action with the entered values when all fields are filled", async () => {
    mockCreateOrganization.mockResolvedValue({
      success: true,
      data: { id: "org-1" },
    });
    const user = userEvent.setup();
    render(<CreateOrganizationForm />);

    await user.type(
      screen.getByLabelText(/organization name/i),
      "Sharma Enterprises"
    );
    await user.selectOptions(
      screen.getByLabelText(/business type/i),
      "private_limited"
    );
    await user.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() =>
      expect(mockCreateOrganization).toHaveBeenCalledTimes(1)
    );
    const formData = mockCreateOrganization.mock.calls[0]?.[0] as FormData;
    expect(formData.get("name")).toBe("Sharma Enterprises");
    expect(formData.get("country")).toBe("IN");
    expect(formData.get("businessType")).toBe("private_limited");
    // Empty optional fields are omitted from the FormData payload.
    expect(formData.get("phone")).toBeNull();
  });

  it("displays a server error returned by the action", async () => {
    mockCreateOrganization.mockResolvedValue({
      success: false,
      error: { code: "duplicate_slug", message: "Organization already exists" },
    });
    const user = userEvent.setup();
    render(<CreateOrganizationForm />);

    await user.type(
      screen.getByLabelText(/organization name/i),
      "Sharma Enterprises"
    );
    await user.selectOptions(
      screen.getByLabelText(/business type/i),
      "private_limited"
    );
    await user.click(screen.getByRole("button", { name: /continue/i }));

    expect(
      await screen.findByText(/organization already exists/i)
    ).toBeInTheDocument();
  });

  it("does not show a server error when the action succeeds", async () => {
    mockCreateOrganization.mockResolvedValue({
      success: true,
      data: { id: "org-1" },
    });
    const user = userEvent.setup();
    render(<CreateOrganizationForm />);

    await user.type(
      screen.getByLabelText(/organization name/i),
      "Sharma Enterprises"
    );
    await user.selectOptions(
      screen.getByLabelText(/business type/i),
      "private_limited"
    );
    await user.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() =>
      expect(mockCreateOrganization).toHaveBeenCalledTimes(1)
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
