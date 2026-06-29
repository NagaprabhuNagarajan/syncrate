import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@/tests/utils";
import { AssistantView } from "@/features/ai/assistant/components/assistant-view";
import {
  sendAssistantMessageAction,
  approveProposedActionAction,
} from "@/features/ai/assistant/actions/assistant.actions";

vi.mock("@/features/ai/assistant/actions/assistant.actions", () => ({
  sendAssistantMessageAction: vi.fn(),
  approveProposedActionAction: vi.fn(),
}));

const sendMock = vi.mocked(sendAssistantMessageAction);
const approveMock = vi.mocked(approveProposedActionAction);

const ORG = "org-1";

function typeAndSend(text: string) {
  const input = screen.getByPlaceholderText(/ask a question/i);
  fireEvent.change(input, { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: /send message/i }));
}

describe("AssistantView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the empty state with suggestions", () => {
    render(<AssistantView organizationId={ORG} />);
    expect(screen.getByText("How can I help?")).toBeInTheDocument();
    expect(
      screen.getByText("Which products are low on stock?")
    ).toBeInTheDocument();
  });

  it("sends a message and renders the assistant reply", async () => {
    sendMock.mockResolvedValue({
      success: true,
      data: {
        text: "You have 12 active customers.",
        toolCalls: [],
        proposedAction: null,
      },
    });

    render(<AssistantView organizationId={ORG} />);
    typeAndSend("How many customers do I have?");

    expect(
      await screen.findByText("How many customers do I have?")
    ).toBeInTheDocument();
    expect(
      await screen.findByText("You have 12 active customers.")
    ).toBeInTheDocument();

    expect(sendMock).toHaveBeenCalledWith(ORG, [
      { role: "user", content: "How many customers do I have?" },
    ]);
  });

  it("renders a proposed invoice and creates it on approval", async () => {
    sendMock.mockResolvedValue({
      success: true,
      data: {
        text: "Here is your draft invoice.",
        toolCalls: [],
        proposedAction: {
          tool: "propose_invoice",
          input: {
            customerId: "c1",
            customerName: "ABC Hardware",
            items: [
              {
                productId: "p1",
                productName: "Cement Bag",
                quantity: 10,
                unitPrice: 350,
                gstRate: 18,
              },
            ],
          },
        },
      },
    });
    approveMock.mockResolvedValue({
      success: true,
      data: { kind: "invoice", id: "inv-1" },
    });

    render(<AssistantView organizationId={ORG} />);
    typeAndSend("Create an invoice for ABC Hardware with 10 Cement Bags");

    // The review card renders with the approval affordance.
    expect(await screen.findByText("Draft invoice")).toBeInTheDocument();
    expect(screen.getByText("Cement Bag")).toBeInTheDocument();
    const approveButton = await screen.findByRole("button", {
      name: /approve & create/i,
    });

    fireEvent.click(approveButton);

    await waitFor(() => {
      expect(approveMock).toHaveBeenCalledWith(ORG, {
        tool: "propose_invoice",
        input: expect.objectContaining({ customerId: "c1" }),
      });
    });
    expect(await screen.findByText(/invoice created/i)).toBeInTheDocument();
  });

  it("shows an error when the assistant call fails", async () => {
    sendMock.mockResolvedValue({
      success: false,
      error: { code: "rate_limited", message: "The AI service is busy." },
    });

    render(<AssistantView organizationId={ORG} />);
    typeAndSend("Hello");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The AI service is busy."
    );
  });
});
