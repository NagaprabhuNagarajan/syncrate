import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type {
  CbnSharedDocument,
  ShareDocumentInput,
} from "@/features/cbn/types/cbn.types";
import { SharedDocumentService } from "./shared-document.service";

// ─────────────────────────────────────────────────────────────
// Hoisted mocks
// ─────────────────────────────────────────────────────────────

const { mockRepo, auditLogMock } = vi.hoisted(() => ({
  mockRepo: {
    create: vi.fn(),
    revoke: vi.fn(),
    findByConnection: vi.fn(),
  },
  auditLogMock: vi.fn(),
}));

vi.mock("@/features/cbn/repositories/shared-document.repository", () => ({
  SharedDocumentRepository: vi.fn(() => mockRepo),
}));

vi.mock("@/features/audit/services/audit.service", () => ({
  AuditService: vi.fn(() => ({ log: auditLogMock })),
}));

// ─────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────

const supabase = {} as unknown as AppSupabaseClient;

const shareInput: ShareDocumentInput = {
  organizationId: "org-1",
  counterpartyOrganizationId: "org-2",
  connectionId: "conn-1",
  documentType: "purchase_order",
};

function buildDoc(): CbnSharedDocument {
  return {
    id: "doc-1",
    organizationId: "org-1",
    counterpartyOrganizationId: "org-2",
    connectionId: "conn-1",
    documentType: "purchase_order",
    documentReferenceType: null,
    documentReferenceId: null,
    documentNumber: null,
    documentDate: null,
    amount: null,
    currency: "INR",
    fileUrl: null,
    fileName: null,
    status: "active",
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
  };
}

function service(): SharedDocumentService {
  return new SharedDocumentService(supabase);
}

beforeEach(() => {
  vi.clearAllMocks();
  auditLogMock.mockResolvedValue(true);
});

// ─────────────────────────────────────────────────────────────
// shareDocument
// ─────────────────────────────────────────────────────────────

describe("SharedDocumentService.shareDocument", () => {
  it("creates the document and audits on success", async () => {
    const doc = buildDoc();
    mockRepo.create.mockResolvedValue(doc);

    const result = await service().shareDocument(shareInput);

    expect(result).toEqual({ success: true, data: doc });
    expect(mockRepo.create).toHaveBeenCalledWith(shareInput);
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        action: "cbn.document.share",
        entityType: "cbn_shared_document",
        entityId: "doc-1",
      })
    );
  });

  it("returns unknown when the repository fails", async () => {
    mockRepo.create.mockResolvedValue(null);

    const result = await service().shareDocument(shareInput);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
    expect(auditLogMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// revokeDocument
// ─────────────────────────────────────────────────────────────

describe("SharedDocumentService.revokeDocument", () => {
  it("revokes the document and audits on success", async () => {
    mockRepo.revoke.mockResolvedValue(true);

    const result = await service().revokeDocument("doc-1", "org-1");

    expect(result).toEqual({ success: true, data: undefined });
    expect(mockRepo.revoke).toHaveBeenCalledWith("doc-1");
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "cbn.document.revoke",
        entityId: "doc-1",
      })
    );
  });

  it("returns unknown when the repository fails", async () => {
    mockRepo.revoke.mockResolvedValue(false);

    const result = await service().revokeDocument("doc-1", "org-1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
    expect(auditLogMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// listForConnection
// ─────────────────────────────────────────────────────────────

describe("SharedDocumentService.listForConnection", () => {
  it("delegates to the repository with params", async () => {
    const docs = [buildDoc()];
    mockRepo.findByConnection.mockResolvedValue(docs);

    const result = await service().listForConnection("conn-1", {
      status: "active",
    });

    expect(result).toBe(docs);
    expect(mockRepo.findByConnection).toHaveBeenCalledWith("conn-1", {
      status: "active",
    });
  });

  it("delegates without params", async () => {
    mockRepo.findByConnection.mockResolvedValue([]);

    await service().listForConnection("conn-1");

    expect(mockRepo.findByConnection).toHaveBeenCalledWith("conn-1", undefined);
  });
});
