import { z } from "zod";

const CONNECTION_PERMISSIONS = [
  "receive_invoices",
  "receive_purchase_orders",
  "receive_quotations",
  "view_catalog",
  "view_stock",
  "receive_payments",
  "share_documents",
  "receive_delivery_updates",
  "view_pricing",
] as const;

export const requestConnectionSchema = z.object({
  requesterOrgId: z.string().uuid("Requester org ID must be a valid UUID"),
  recipientOrgId: z.string().uuid("Recipient org ID must be a valid UUID"),
  message: z.string().max(500, "Message must not exceed 500 characters").optional(),
  // The local party is required: a connection with nothing to post against is
  // the state that made document exchange fail at accept time.
  counterpartyRole: z.enum(["customer", "supplier"], {
    errorMap: () => ({ message: "Choose whether they are a customer or supplier" }),
  }),
  linkEntityId: z
    .string()
    .uuid("Select one of your customers or suppliers to link"),
});

export type RequestConnectionInput = z.infer<typeof requestConnectionSchema>;

export const updatePermissionsSchema = z.object({
  connectionId: z.string().uuid("Connection ID must be a valid UUID"),
  myGrants: z
    .array(z.enum(CONNECTION_PERMISSIONS))
    .min(0)
    .describe("Permissions granted to the counterparty"),
});

export type UpdatePermissionsInput = z.infer<typeof updatePermissionsSchema>;
