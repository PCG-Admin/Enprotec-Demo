-- Adds optional attachment support to stock receipt records.
alter table public.enprotec_stock_receipts
    add column if not exists attachment_url text;

create or replace view public.enprotec_stock_receipts_view as
select
    r.id,
    si.part_number as "partNumber",
    si.description,
    r.quantity_received as "quantityReceived",
    u.name as "receivedBy",
    r.received_at as "receivedAt",
    r.store,
    r.delivery_note_po as "deliveryNotePO",
    r.attachment_url as "attachmentUrl",
    r.comments
from public.enprotec_stock_receipts r
join public.enprotec_stock_items si on r.stock_item_id = si.id
join public.enprotec_users u on r.received_by_id = u.id;
