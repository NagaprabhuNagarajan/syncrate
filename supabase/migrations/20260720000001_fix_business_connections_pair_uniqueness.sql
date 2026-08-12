-- =============================================================================
-- Migration: Scope business_connections pair-uniqueness to live rows
-- =============================================================================
-- `uq_business_connections_pair` was a plain table constraint:
--
--   CONSTRAINT uq_business_connections_pair
--     UNIQUE (requester_organization_id, recipient_organization_id)
--
-- A plain UNIQUE constraint cannot carry a WHERE predicate, so soft-deleted
-- rows keep occupying their org pair forever. That breaks reconnection:
-- request_business_connection soft-deletes a rejected/disconnected row and
-- then inserts a replacement — its own comment reads "Soft-delete the old one
-- first to satisfy unique constraint" — but the soft-deleted row still holds
-- the pair, so the INSERT dies with "duplicate key value violates unique
-- constraint". Once two orgs had rejected each other even once, they could
-- never connect again, and the failure surfaced as an opaque duplicate error
-- rather than the RPC's own explanatory guard.
--
-- Fix: replace it with a PARTIAL unique index over live rows only. The index
-- keys on LEAST/GREATEST of the two org IDs so A→B and B→A count as the same
-- pair — the table's header comment always claimed that was enforced ("the
-- requester must always be < recipient by UUID ordering ... enforced by
-- CHECK"), but no such CHECK was ever created, so the DB permitted two live
-- connections between the same pair in opposite directions. Only the RPC's
-- bidirectional lookup prevented it.
--
-- Existing violators are soft-deleted before the index is built, keeping the
-- most meaningful row per pair (accepted > pending > anything else, then most
-- recently updated) so no live connection is lost.
-- =============================================================================

-- 1. Drop the over-broad constraint.
ALTER TABLE public.business_connections
  DROP CONSTRAINT IF EXISTS uq_business_connections_pair;

-- 2. Soft-delete duplicate live rows per unordered org pair, keeping the best.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY
        LEAST(requester_organization_id, recipient_organization_id),
        GREATEST(requester_organization_id, recipient_organization_id)
      ORDER BY
        CASE status
          WHEN 'accepted' THEN 0
          WHEN 'pending'  THEN 1
          ELSE 2
        END,
        updated_at DESC,
        created_at DESC
    ) AS rn
  FROM public.business_connections
  WHERE deleted_at IS NULL
)
UPDATE public.business_connections AS c
   SET deleted_at = NOW(),
       updated_at = NOW()
  FROM ranked AS r
 WHERE c.id = r.id
   AND r.rn > 1;

-- 3. Enforce one LIVE connection per org pair, in either direction.
CREATE UNIQUE INDEX IF NOT EXISTS uq_business_connections_pair
  ON public.business_connections (
    LEAST(requester_organization_id, recipient_organization_id),
    GREATEST(requester_organization_id, recipient_organization_id)
  )
  WHERE deleted_at IS NULL;

COMMENT ON INDEX public.uq_business_connections_pair IS
  'One live connection per organization pair, direction-agnostic. Partial on deleted_at IS NULL so soft-deleted rows can be replaced by a new request.';
