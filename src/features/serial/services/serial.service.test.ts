import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { SerialNumber } from "@/features/serial/types/serial.types";
import { SerialService } from "./serial.service";

// ─────────────────────────────────────────────────────────────
// Mock the repository the service instantiates internally
// ─────────────────────────────────────────────────────────────

const { mockRepo } = vi.hoisted(() => ({
  mockRepo: {
    list: vi.fn(),
    findById: vi.fn(),
    findBySerial: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
  },
}));

vi.mock("@/features/serial/repositories/serial.repository", () => ({
  SerialRepository: vi.fn(() => mockRepo),
}));

// ─────────────────────────────────────────────────────────────
// Builders
// ─────────────────────────────────────────────────────────────

function buildSerial(overrides: Partial<SerialNumber> = {}): SerialNumber {
  return {
    id: "ser-1",
    organizationId: "org-1",
    productId: "prod-1",
    productName: "Laptop",
    productCode: "LAP-1",
    warehouseId: null,
    batchId: null,
    serialNumber: "SN-0001",
    status: "in_stock",
    referenceType: null,
    referenceId: null,
    notes: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    createdBy: "user-1",
    ...overrides,
  };
}

let service: SerialService;

beforeEach(() => {
  vi.clearAllMocks();
  service = new SerialService({} as unknown as AppSupabaseClient);
});

// ─────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────

describe("SerialService.listSerials", () => {
  it("delegates to the repository", async () => {
    const listResult = {
      items: [buildSerial()],
      total: 1,
      page: 1,
      pageSize: 20,
    };
    mockRepo.list.mockResolvedValue(listResult);

    const result = await service.listSerials("org-1", { search: "SN" });
    expect(result).toBe(listResult);
    expect(mockRepo.list).toHaveBeenCalledWith("org-1", { search: "SN" });
  });
});

describe("SerialService.getSerial", () => {
  it("returns the serial when found", async () => {
    mockRepo.findById.mockResolvedValue(buildSerial());
    const result = await service.getSerial("ser-1");
    expect(result).toEqual({ success: true, data: buildSerial() });
  });

  it("returns not_found when missing", async () => {
    mockRepo.findById.mockResolvedValue(null);
    const result = await service.getSerial("ser-1");
    expect(result).toEqual({
      success: false,
      error: { code: "not_found", message: "Serial number not found" },
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Create (single)
// ─────────────────────────────────────────────────────────────

describe("SerialService.createSerial", () => {
  it("creates a serial when no duplicate exists", async () => {
    mockRepo.findBySerial.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(buildSerial());

    const result = await service.createSerial(
      { productId: "prod-1", serialNumber: "  SN-0001  ", warehouseId: "" },
      "org-1",
      "user-1"
    );

    expect(result.success).toBe(true);
    const insertArg = mockRepo.create.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(insertArg.serial_number).toBe("SN-0001");
    expect(insertArg.status).toBe("in_stock");
    expect(insertArg.warehouse_id).toBeNull();
    expect(insertArg.created_by).toBe("user-1");
  });

  it("returns duplicate_serial when the serial already exists", async () => {
    mockRepo.findBySerial.mockResolvedValue(buildSerial());

    const result = await service.createSerial(
      { productId: "prod-1", serialNumber: "SN-0001" },
      "org-1",
      "user-1"
    );

    expect(result).toEqual({
      success: false,
      error: {
        code: "duplicate_serial",
        message: 'Serial number "SN-0001" already exists',
      },
    });
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it("returns unknown when the repository fails to create", async () => {
    mockRepo.findBySerial.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(null);

    const result = await service.createSerial(
      { productId: "prod-1", serialNumber: "SN-0001" },
      "org-1",
      "user-1"
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });
});

// ─────────────────────────────────────────────────────────────
// Bulk create
// ─────────────────────────────────────────────────────────────

describe("SerialService.bulkCreateSerials", () => {
  it("creates all unique serials and reports counts", async () => {
    mockRepo.findBySerial.mockResolvedValue(null);
    mockRepo.create.mockImplementation((input: { serial_number: string }) =>
      Promise.resolve(buildSerial({ serialNumber: input.serial_number }))
    );

    const result = await service.bulkCreateSerials(
      ["SN-1", "SN-2"],
      "prod-1",
      "org-1",
      "user-1"
    );

    expect(result).toEqual({ created: 2, skipped: 0, errors: [] });
    expect(mockRepo.create).toHaveBeenCalledTimes(2);
  });

  it("skips in-batch duplicates", async () => {
    mockRepo.findBySerial.mockResolvedValue(null);
    mockRepo.create.mockImplementation((input: { serial_number: string }) =>
      Promise.resolve(buildSerial({ serialNumber: input.serial_number }))
    );

    const result = await service.bulkCreateSerials(
      ["SN-1", "SN-1", "  ", "SN-2"],
      "prod-1",
      "org-1",
      "user-1"
    );

    expect(result.created).toBe(2);
    expect(result.skipped).toBe(1);
    expect(result.errors[0]).toEqual({
      serial: "SN-1",
      message: "Duplicate within this batch",
    });
  });

  it("collects errors for serials that already exist in the DB", async () => {
    mockRepo.findBySerial.mockImplementation(
      (_org: string, serial: string) =>
        Promise.resolve(serial === "SN-1" ? buildSerial() : null)
    );
    mockRepo.create.mockImplementation((input: { serial_number: string }) =>
      Promise.resolve(buildSerial({ serialNumber: input.serial_number }))
    );

    const result = await service.bulkCreateSerials(
      ["SN-1", "SN-2"],
      "prod-1",
      "org-1",
      "user-1"
    );

    expect(result.created).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].serial).toBe("SN-1");
  });
});

// ─────────────────────────────────────────────────────────────
// Update
// ─────────────────────────────────────────────────────────────

describe("SerialService.updateSerial", () => {
  it("updates the serial and maps the patch to snake_case", async () => {
    mockRepo.update.mockResolvedValue(buildSerial({ status: "sold" }));

    const result = await service.updateSerial(
      "ser-1",
      { status: "sold", warehouseId: "", notes: "moved" },
      "org-1",
      "user-9"
    );

    expect(result.success).toBe(true);
    const [, patch] = mockRepo.update.mock.calls[0] as [
      string,
      Record<string, unknown>,
      string,
    ];
    expect(patch.status).toBe("sold");
    expect(patch.warehouse_id).toBeNull();
    expect(patch.notes).toBe("moved");
  });

  it("guards against a duplicate serial owned by another record", async () => {
    mockRepo.findBySerial.mockResolvedValue(buildSerial({ id: "other" }));

    const result = await service.updateSerial(
      "ser-1",
      { serialNumber: "SN-DUP" },
      "org-1",
      "user-9"
    );

    expect(result).toEqual({
      success: false,
      error: {
        code: "duplicate_serial",
        message: 'Serial number "SN-DUP" already exists',
      },
    });
    expect(mockRepo.update).not.toHaveBeenCalled();
  });

  it("allows keeping the same serial on the same record", async () => {
    mockRepo.findBySerial.mockResolvedValue(buildSerial({ id: "ser-1" }));
    mockRepo.update.mockResolvedValue(buildSerial());

    const result = await service.updateSerial(
      "ser-1",
      { serialNumber: "SN-0001" },
      "org-1",
      "user-9"
    );

    expect(result.success).toBe(true);
  });

  it("returns not_found when the update fails", async () => {
    mockRepo.update.mockResolvedValue(null);

    const result = await service.updateSerial(
      "ser-1",
      { status: "sold" },
      "org-1",
      "user-9"
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });
});

// ─────────────────────────────────────────────────────────────
// Archive
// ─────────────────────────────────────────────────────────────

describe("SerialService.archiveSerial", () => {
  it("archives an existing serial", async () => {
    mockRepo.findById.mockResolvedValue(buildSerial());
    mockRepo.softDelete.mockResolvedValue(true);

    const result = await service.archiveSerial("ser-1", "user-9");
    expect(result).toEqual({ success: true, data: undefined });
    expect(mockRepo.softDelete).toHaveBeenCalledWith("ser-1", "user-9");
  });

  it("returns not_found when the serial does not exist", async () => {
    mockRepo.findById.mockResolvedValue(null);

    const result = await service.archiveSerial("ser-1", "user-9");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
    expect(mockRepo.softDelete).not.toHaveBeenCalled();
  });

  it("returns unknown when the soft delete fails", async () => {
    mockRepo.findById.mockResolvedValue(buildSerial());
    mockRepo.softDelete.mockResolvedValue(false);

    const result = await service.archiveSerial("ser-1", "user-9");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });
});
