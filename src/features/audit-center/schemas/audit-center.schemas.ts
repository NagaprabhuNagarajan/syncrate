import { z } from "zod";

/**
 * Validation for Audit Center filter input. Filters arrive from the client
 * (server action boundary) and must never be trusted — parse them server-side.
 */
export const auditCenterFiltersSchema = z.object({
  source: z.enum(["all", "business", "ai", "network"]).optional(),
  search: z.string().trim().max(200).optional(),
  actor: z.string().trim().max(200).optional(),
  from: z.string().trim().max(40).optional(),
  to: z.string().trim().max(40).optional(),
  page: z.number().int().positive().max(100_000).optional(),
  pageSize: z.number().int().positive().max(200).optional(),
});

export type AuditCenterFiltersInput = z.infer<typeof auditCenterFiltersSchema>;
