import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { OrganizationContext } from "@/features/organization/types/organization.types";
import type { ForecastResult } from "@/features/ai/forecasting/types/forecast.types";
import { generateForecastAction } from "./forecasting.actions";

const {
  mockForecastingService,
  mockOrgService,
  getUserMock,
  createClientMock,
} = vi.hoisted(() => ({
  mockForecastingService: { generateForecast: vi.fn() },
  mockOrgService: { getOrganizationContext: vi.fn() },
  getUserMock: vi.fn(),
  createClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: createClientMock,
}));

vi.mock("@/features/organization/services/organization.service", () => ({
  OrganizationService: vi.fn(() => mockOrgService),
}));

vi.mock("@/features/ai/forecasting/services/forecasting.service", () => ({
  ForecastingService: vi.fn(() => mockForecastingService),
}));

const fakeSupabase = {
  auth: { getUser: getUserMock },
} as unknown as AppSupabaseClient;

function contextWith(permissions: readonly string[]): OrganizationContext {
  return { permissions } as unknown as OrganizationContext;
}

const FORECAST: ForecastResult = {
  confidence: 0.6,
  summary: "Outlook",
  reason: "Trend",
  points: [],
  assumptions: [],
  drivers: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  createClientMock.mockResolvedValue(fakeSupabase);
  getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
});

describe("generateForecastAction", () => {
  it("rejects an unknown forecast type before touching auth", async () => {
    const result = await generateForecastAction("org-1", "weather");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("validation");
    }
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("forbids unauthenticated callers", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    const result = await generateForecastAction("org-1", "sales");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("forbidden");
    }
  });

  it("forbids callers without access to the organization", async () => {
    mockOrgService.getOrganizationContext.mockResolvedValue(null);

    const result = await generateForecastAction("org-1", "sales");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("forbidden");
    }
  });

  it("forbids callers lacking the ai.generate permission", async () => {
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["ai.view"])
    );

    const result = await generateForecastAction("org-1", "sales");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("forbidden");
    }
    expect(mockForecastingService.generateForecast).not.toHaveBeenCalled();
  });

  it("delegates to the forecasting service when authorized", async () => {
    mockOrgService.getOrganizationContext.mockResolvedValue(
      contextWith(["ai.generate"])
    );
    mockForecastingService.generateForecast.mockResolvedValue({
      success: true,
      data: FORECAST,
    });

    const result = await generateForecastAction("org-1", "sales");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(FORECAST);
    }
    expect(mockForecastingService.generateForecast).toHaveBeenCalledWith(
      "sales",
      { organizationId: "org-1", userId: "user-1" }
    );
  });
});
