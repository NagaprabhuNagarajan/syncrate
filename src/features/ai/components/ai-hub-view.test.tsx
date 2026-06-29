import { describe, expect, it } from "vitest";
import { render, screen } from "@/tests/utils";
import type { AiInteraction } from "@/features/ai/types/ai.types";
import { AiHubView } from "./ai-hub-view";

function buildInteraction(
  overrides: Partial<AiInteraction> = {}
): AiInteraction {
  return {
    id: "ai-1",
    organizationId: "org-1",
    actorUserId: "user-1",
    capability: "forecast",
    model: "claude-opus-4-8",
    promptSummary: null,
    responseSummary: null,
    confidence: 0.82,
    inputTokens: 100,
    outputTokens: 50,
    executionMs: 1200,
    approvalStatus: "not_required",
    status: "success",
    errorMessage: null,
    metadata: {},
    createdAt: "2026-06-29T10:00:00Z",
    ...overrides,
  };
}

describe("AiHubView", () => {
  it("renders all capability launchers", () => {
    render(<AiHubView recentActivity={[]} aiConfigured />);

    expect(screen.getByText("Business Assistant")).toBeInTheDocument();
    expect(screen.getByText("Document OCR")).toBeInTheDocument();
    expect(screen.getByText("Forecasting")).toBeInTheDocument();
    expect(screen.getByText("Recommendations")).toBeInTheDocument();
    expect(screen.getByText("Business Insights")).toBeInTheDocument();
    expect(screen.getByText("Smart Search")).toBeInTheDocument();
    expect(screen.getByText("Smart Reports")).toBeInTheDocument();
  });

  it("shows the not-configured warning when AI is off", () => {
    render(<AiHubView recentActivity={[]} aiConfigured={false} />);
    expect(screen.getByText(/ANTHROPIC_API_KEY/)).toBeInTheDocument();
  });

  it("hides the warning when AI is configured", () => {
    render(<AiHubView recentActivity={[]} aiConfigured />);
    expect(screen.queryByText(/ANTHROPIC_API_KEY/)).not.toBeInTheDocument();
  });

  it("shows an empty state when there is no activity", () => {
    render(<AiHubView recentActivity={[]} aiConfigured />);
    expect(screen.getByText("No AI activity yet")).toBeInTheDocument();
  });

  it("renders recent activity with confidence and status", () => {
    render(
      <AiHubView
        recentActivity={[buildInteraction()]}
        aiConfigured
      />
    );
    expect(screen.getByText("Forecast")).toBeInTheDocument();
    expect(screen.getByText("82%")).toBeInTheDocument();
    expect(screen.getByText("success")).toBeInTheDocument();
  });
});
