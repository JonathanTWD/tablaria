-- Multiple relations (ADR-032): every relation says whether it links to one
-- record or to a list of them. Existing ones link to one.
UPDATE "columns"
SET "options" = "options" || '{"multiple": false}'::jsonb
WHERE "type" = 'relation' AND NOT ("options" ? 'multiple');
