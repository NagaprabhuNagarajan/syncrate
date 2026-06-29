import { describe, expect, it, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type {
  AiInteraction,
  RecordInteractionInput,
} from "@/features/ai/types/ai.types";
import { AiInteractionService } from "./ai-interaction.service";

const { mockRepo } = vi.hoisted(() => ({
  mockRepo: {
    insert: vi.fn(),
    listByOrg: vi.fn(),
  },
}));

vi.mock("@/features/ai/repositories/ai-interaction.repository", () => ({
  AiInteractionRepository: vi.fn(() => mockRepo),
}));

const fakeSupabase = {} as unknown as AppSupabaseClient;

function buildInput(
  overrides: Partial<RecordInteractionInput> = {}
): RecordInteractionInput {
  return {
    organizationId: "org-1",
    actorUserId: "user-1",
    capability: "forecast",
    model: "claude-opus-4-8",
    usage: { inputTokens: 100, outputTokens: 50, executionMs: 1200 },
    ...overrides,
  };
}

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
    confidence: null,
    inputTokens: 100,
    outputTokens: 50,
    executionMs: 1200,
    approvalStatus: "not_required",
    status: "success",
    errorMessage: null,
    metadata: {},
    createdAt: "2026-06-29T00:00:00Z",
    ...overrides,
  };
}

describe("AiInteractionService", () => {
  let service: AiInteractionService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AiInteractionService(fakeSupabase);
  });

  describe("record", () => {
    it("delegates to the repository and returns the row", async () => {
      const row = buildInteraction();
      mockRepo.insert.mockResolvedValue(row);

      const result = await service.record(buildInput());

      expect(mockRepo.insert).toHaveBeenCalledOnce();
      expect(result).toEqual(row);
    });

    it("is best-effort: returns null when the repo returns null", async () => {
      mockRepo.insert.mockResolvedValue(null);
      const result = await service.record(buildInput());
      expect(result).toBeNull();
    });

    it("is best-effort: swallows repo errors and returns null", async () => {
      mockRepo.insert.mockRejectedValue(new Error("db down"));
      const result = await service.record(buildInput());
      expect(result).toBeNull();
    });
  });

  describe("list", () => {
    it("delegates to listByOrg with params", async () => {
      const rows = [buildInteraction()];
      mockRepo.listByOrg.mockResolvedValue(rows);

      const result = await service.list("org-1", { capability: "ocr", limit: 10 });

      expect(mockRepo.listByOrg).toHaveBeenCalledWith("org-1", {
        capability: "ocr",
        limit: 10,
      });
      expect(result).toEqual(rows);
    });
  });
});
