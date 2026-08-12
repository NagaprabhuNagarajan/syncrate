-- =============================================================================
-- Migration: Link customers / suppliers to a CBN connection
-- =============================================================================
-- A CBN connection is a relationship between two ORGANIZATIONS, but each side
-- already keeps its own local record for the other party: you have a `customer`
-- row for the business you sell to, they have a `supplier` row for you.
--
-- Linking those local records to the connection is what makes document exchange
-- implicit: posting an invoice for a linked customer can be sent straight to
-- that customer's organization — no "pick a connection" step.
--
-- The link lives on the LOCAL record (not on business_connections) because that
-- row is shared by both orgs; "whose customer is it?" would be ambiguous there.
-- customers/suppliers are already org-scoped with RLS, so each side links its
-- own record independently.
--
-- Nullable: most customers/suppliers are not on the network.
-- ON DELETE SET NULL: removing a connection unlinks, never deletes the party.
-- =============================================================================

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS cbn_connection_id UUID
    REFERENCES public.business_connections(id) ON DELETE SET NULL;

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS cbn_connection_id UUID
    REFERENCES public.business_connections(id) ON DELETE SET NULL;

-- One local record per connection, per org — prevents two customers both
-- claiming the same connected business.
CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_cbn_connection
  ON public.customers(organization_id, cbn_connection_id)
  WHERE cbn_connection_id IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_suppliers_cbn_connection
  ON public.suppliers(organization_id, cbn_connection_id)
  WHERE cbn_connection_id IS NOT NULL AND deleted_at IS NULL;

COMMENT ON COLUMN public.customers.cbn_connection_id IS
  'Accepted CBN connection representing this customer''s organization. When set, documents can be exchanged with them over the network.';
COMMENT ON COLUMN public.suppliers.cbn_connection_id IS
  'Accepted CBN connection representing this supplier''s organization. When set, documents can be exchanged with them over the network.';
