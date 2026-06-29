import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, within } from "@/tests/utils";
import { WebhooksView } from "./webhooks-view";
import type {
  WebhookDelivery,
  WebhookEndpoint,
} from "@/features/webhooks/types/webhook.types";

// ─────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────

const {
  mockRefresh,
  createActionMock,
  updateActionMock,
  deleteActionMock,
  testActionMock,
} = vi.hoisted(() => ({
  mockRefresh: vi.fn(),
  createActionMock: vi.fn(),
  updateActionMock: vi.fn(),
  deleteActionMock: vi.fn(),
  testActionMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: mockRefresh }),
}));

vi.mock("@/features/webhooks/actions/webhook.actions", () => ({
  createWebhookEndpointAction: createActionMock,
  updateWebhookEndpointAction: updateActionMock,
  deleteWebhookEndpointAction: deleteActionMock,
  sendTestWebhookAction: testActionMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────

function makeEndpoint(
  overrides: Partial<WebhookEndpoint> = {}
): WebhookEndpoint {
  return {
    id: "ep-1",
    organizationId: "org-1",
    url: "https://example.com/hook",
    description: "Accounting sync",
    eventTypes: ["invoice.paid"],
    isActive: true,
    version: 1,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    createdBy: "user-1",
    ...overrides,
  };
}

function makeDelivery(
  overrides: Partial<WebhookDelivery> = {}
): WebhookDelivery {
  return {
    id: "del-1",
    organizationId: "org-1",
    endpointId: "ep-1",
    eventType: "invoice.paid",
    status: "success",
    attempts: 1,
    responseStatus: 200,
    error: null,
    createdAt: new Date("2026-02-01"),
    deliveredAt: new Date("2026-02-01"),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("WebhooksView", () => {
  it("renders endpoints with url, events, status and last delivery", () => {
    render(
      <WebhooksView
        organizationId="org-1"
        endpoints={[makeEndpoint()]}
        deliveriesByEndpoint={{ "ep-1": [makeDelivery()] }}
        canManage
      />
    );
    expect(
      screen.getByRole("heading", { name: /webhooks/i })
    ).toBeInTheDocument();
    expect(screen.getByText("https://example.com/hook")).toBeInTheDocument();
    expect(screen.getByText("Invoice paid")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText(/last delivery:/i)).toBeInTheDocument();
  });

  it("renders an empty state when there are no endpoints", () => {
    render(
      <WebhooksView
        organizationId="org-1"
        endpoints={[]}
        deliveriesByEndpoint={{}}
        canManage
      />
    );
    expect(
      screen.getByText(/no webhook endpoints yet/i)
    ).toBeInTheDocument();
  });

  it("hides management controls when canManage is false", () => {
    render(
      <WebhooksView
        organizationId="org-1"
        endpoints={[makeEndpoint()]}
        deliveriesByEndpoint={{ "ep-1": [] }}
        canManage={false}
      />
    );
    expect(
      screen.queryByRole("button", { name: /add endpoint/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /send test event/i })
    ).not.toBeInTheDocument();
  });

  it("creates an endpoint and reveals the signing secret exactly once", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    createActionMock.mockResolvedValue({
      success: true,
      data: {
        endpoint: makeEndpoint(),
        secret: "whsec_0123456789abcdef0123456789abcdef0123456789abcdef",
      },
    });

    render(
      <WebhooksView
        organizationId="org-1"
        endpoints={[]}
        deliveriesByEndpoint={{}}
        canManage
      />
    );

    await user.click(
      screen.getByRole("button", { name: /add your first endpoint/i })
    );
    await user.type(
      screen.getByLabelText(/endpoint url/i),
      "https://hooks.example.com/in"
    );
    await user.click(screen.getByRole("checkbox", { name: /invoice paid/i }));
    await user.click(
      screen.getByRole("button", { name: /create endpoint/i })
    );

    expect(createActionMock).toHaveBeenCalledTimes(1);
    expect(createActionMock.mock.calls[0]?.[0]).toBe("org-1");
    const formData = createActionMock.mock.calls[0]?.[1] as FormData;
    expect(formData.get("url")).toBe("https://hooks.example.com/in");
    expect(formData.getAll("eventTypes")).toContain("invoice.paid");

    const alert = await screen.findByRole("alert");
    expect(
      within(alert).getByText(
        "whsec_0123456789abcdef0123456789abcdef0123456789abcdef"
      )
    ).toBeInTheDocument();
    expect(within(alert).getByText(/only time/i)).toBeInTheDocument();
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("surfaces a create error without revealing a secret", async () => {
    const user = userEvent.setup();
    createActionMock.mockResolvedValue({
      success: false,
      error: { code: "validation", message: "URL must use https://" },
    });

    render(
      <WebhooksView
        organizationId="org-1"
        endpoints={[]}
        deliveriesByEndpoint={{}}
        canManage
      />
    );

    await user.click(
      screen.getByRole("button", { name: /add your first endpoint/i })
    );
    await user.type(
      screen.getByLabelText(/endpoint url/i),
      "http://insecure.example.com"
    );
    await user.click(
      screen.getByRole("button", { name: /create endpoint/i })
    );

    expect(
      await screen.findByText("URL must use https://")
    ).toBeInTheDocument();
  });

  it("sends a test event for an endpoint", async () => {
    const user = userEvent.setup();
    testActionMock.mockResolvedValue({
      success: true,
      data: makeDelivery(),
    });

    render(
      <WebhooksView
        organizationId="org-1"
        endpoints={[makeEndpoint()]}
        deliveriesByEndpoint={{ "ep-1": [] }}
        canManage
      />
    );

    await user.click(
      screen.getByRole("button", { name: /send test event/i })
    );

    expect(testActionMock).toHaveBeenCalledWith("org-1", "ep-1");
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("deletes an endpoint after confirmation", async () => {
    const user = userEvent.setup();
    deleteActionMock.mockResolvedValue({
      success: true,
      data: makeEndpoint(),
    });

    render(
      <WebhooksView
        organizationId="org-1"
        endpoints={[makeEndpoint()]}
        deliveriesByEndpoint={{ "ep-1": [] }}
        canManage
      />
    );

    await user.click(screen.getByRole("button", { name: /delete https/i }));
    const dialog = screen.getByRole("alertdialog", {
      name: /delete webhook endpoint/i,
    });
    await user.click(
      within(dialog).getByRole("button", { name: /delete endpoint/i })
    );

    expect(deleteActionMock).toHaveBeenCalledWith("org-1", "ep-1");
    expect(mockRefresh).toHaveBeenCalled();
  });
});
