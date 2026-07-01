-- Add a multi-value GST rates column to products.
--
-- A product can now carry several applicable GST slabs (gst_rates), while the
-- existing scalar gst_rate is retained as the product's primary/default rate —
-- it is what sales/purchase/AI flows read to prefill a transaction line's tax.
-- The service layer keeps gst_rate in sync as the first element of gst_rates.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS gst_rates NUMERIC(5, 2)[] NOT NULL DEFAULT '{}';

-- Backfill: existing single rate becomes a one-element array.
UPDATE products
SET gst_rates = ARRAY[gst_rate]
WHERE gst_rate IS NOT NULL
  AND (gst_rates IS NULL OR cardinality(gst_rates) = 0);

-- Every selected rate must be a valid GST slab.
ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_gst_rates_valid;

ALTER TABLE products
  ADD CONSTRAINT products_gst_rates_valid
  CHECK (gst_rates <@ ARRAY[0, 5, 12, 18, 28]::numeric[]);
