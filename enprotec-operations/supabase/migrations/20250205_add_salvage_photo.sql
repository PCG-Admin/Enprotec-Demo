-- Add a photo URL to salvage requests so booking to salvage can include evidence
ALTER TABLE public.enprotec_salvage_requests
    ADD COLUMN IF NOT EXISTS photo_url text;

-- Refresh salvage view to expose the photo
CREATE OR REPLACE VIEW public.enprotec_salvage_requests_view AS
SELECT
    sr.id,
    sr.stock_item_id,
    si.part_number AS "partNumber",
    si.description,
    sr.quantity,
    sr.status,
    sr.notes,
    sr.source_department AS "sourceStore",
    sr.photo_url AS "photoUrl",
    creator.name AS "createdBy",
    sr.created_at AS "createdAt",
    decider.name AS "decisionBy",
    sr.decision_at AS "decisionAt"
FROM public.enprotec_salvage_requests sr
JOIN public.enprotec_stock_items si ON sr.stock_item_id = si.id
JOIN public.enprotec_users creator ON sr.created_by_id = creator.id
LEFT JOIN public.enprotec_users decider ON sr.decision_by_id = decider.id;
