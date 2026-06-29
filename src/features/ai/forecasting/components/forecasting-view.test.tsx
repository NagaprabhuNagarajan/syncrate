import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/tests/utils";
import { ForecastingView } from "./forecasting-view";
import type { ForecastResult } from "@/features/ai/forecasting/types/forecast.types";

vi.mock("@/features/ai/forecasting/hooks/useForecast", () => ({
  useForecast: vi.fn(),
}));

import { useForecast } from "@/features/ai/forecasting/hooks/useForecast";

const useForecastMock = vi.mocked(useForecast);

const FORECAST: ForecastResult = {
  confidence: 0.82,
  summary: "Sales should climb steadily next quarter.",
  reason: "Consistent month-over-month growth in invoiced value.",
  points: [
    { period: "2026-07", predicted: 12000, low: 10000, high: 14000 },
    { period: "2026-08", predicted: 12800, low: null, high: null },
  ],
  assumptions: ["No major customer churn"],
  drivers: ["Seasonal uptick"],
};

function mockHook(overrides: Partial<ReturnType<typeof useForecast>> = {}) {
  useForecastMock.mockReturnValue({
    forecast: null,
    isLoading: false,
    error: null,
    forecastType: null,
    run: vi.fn(),
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ForecastingView", () => {
  it("renders the heading, type options, and the initial empty state", () => {
    mockHook();
    render(<ForecastingView organizationId="org-1" />);

    expect(
      screen.getByRole("heading", { name: /ai forecasting/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sales/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /cash flow/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /seasonal demand/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/no forecast yet/i)).toBeInTheDocument();
  });

  it("invokes run with the org id and selected type on click", async () => {
    const run = vi.fn();
    mockHook({ run });
    const user = userEvent.setup();

    render(<ForecastingView organizationId="org-7" />);
    await user.click(screen.getByRole("button", { name: /sales/i }));

    expect(run).toHaveBeenCalledWith("org-7", "sales");
  });

  it("shows the loading state and disables the type buttons", () => {
    mockHook({ isLoading: true, forecastType: "sales" });
    render(<ForecastingView organizationId="org-1" />);

    expect(screen.getByText(/generating forecast/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sales/i })).toBeDisabled();
  });

  it("renders the forecast result: confidence, points, summary, assumptions, drivers", () => {
    mockHook({ forecast: FORECAST, forecastType: "sales" });
    render(<ForecastingView organizationId="org-1" />);

    expect(screen.getByText(/82% confidence/i)).toBeInTheDocument();
    expect(screen.getByText(FORECAST.summary)).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: /forecast by period/i })
    ).toBeInTheDocument();
    expect(screen.getByText("2026-07")).toBeInTheDocument();
    expect(screen.getByText("No major customer churn")).toBeInTheDocument();
    expect(screen.getByText("Seasonal uptick")).toBeInTheDocument();
  });

  it("renders an error state when the forecast fails", () => {
    mockHook({ error: "The AI service is busy." });
    render(<ForecastingView organizationId="org-1" />);

    expect(screen.getByText(/could not generate forecast/i)).toBeInTheDocument();
    expect(screen.getByText(/the ai service is busy/i)).toBeInTheDocument();
    expect(screen.queryByText(/no forecast yet/i)).not.toBeInTheDocument();
  });
});
