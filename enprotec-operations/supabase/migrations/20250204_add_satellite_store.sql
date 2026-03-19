-- Adds the Satellite store/department to existing Supabase enums and refreshes
-- dependent helpers so the new option behaves like the legacy stores.
-- Safe to re-run; IF NOT EXISTS guards prevent duplicate enum values.

alter type public.department add value if not exists 'Satellite';
alter type public.store_type add value if not exists 'Satellite';

create or replace view public.enprotec_workflows_view as
select
    wr.id,
    wr.request_number as "requestNumber",
    wr.type,
    u.name as requester,
    wr.requester_id,
    s.name as "projectCode",
    wr.department,
    wr.current_status as "currentStatus",
    wr.priority,
    wr.created_at as "createdAt",
    wr.attachment_url as "attachmentUrl",
    wr.rejection_comment as "rejectionComment",
    (
        select coalesce(jsonb_agg(items_data.item_object), '[]'::jsonb)
        from (
            select
                jsonb_build_object(
                    'partNumber', si.part_number,
                    'description', si.description,
                    'quantityRequested', wi.quantity_requested,
                    'quantityOnHand', coalesce(inv.quantity_on_hand, 0)
                ) as item_object
            from public.enprotec_workflow_items wi
            join public.enprotec_stock_items si on wi.stock_item_id = si.id
            left join public.enprotec_inventory inv
                on wi.stock_item_id = inv.stock_item_id
                and inv.store = (
                    case wr.department
                        when 'OEM' then 'OEM'::public.store_type
                        when 'Operations' then 'Operations'::public.store_type
                        when 'Projects' then 'Projects'::public.store_type
                        when 'SalvageYard' then 'SalvageYard'::public.store_type
                        when 'Satellite' then 'Satellite'::public.store_type
                    end
                )
            where wi.workflow_request_id = wr.id
            order by si.part_number
        ) as items_data
    ) as items,
    ARRAY[
        'Request Submitted',
        'Awaiting Equip. Manager',
        'Awaiting Picking',
        'Picked & Loaded',
        'Dispatched',
        'EPOD Confirmed',
        'Completed'
    ]::public.workflow_status[] as steps
from public.enprotec_workflow_requests wr
join public.enprotec_users u on wr.requester_id = u.id
left join public.enprotec_sites s on wr.site_id = s.id;

create or replace function public.on_dispatch_deduct_stock()
returns trigger as $$
declare
    item_record record;
    target_store public.store_type;
begin
    if new.current_status = 'Dispatched' and old.current_status <> 'Dispatched' then
        case new.department
            when 'OEM' then target_store := 'OEM'::public.store_type;
            when 'Operations' then target_store := 'Operations'::public.store_type;
            when 'Projects' then target_store := 'Projects'::public.store_type;
            when 'SalvageYard' then target_store := 'SalvageYard'::public.store_type;
            when 'Satellite' then target_store := 'Satellite'::public.store_type;
        end case;

        if target_store is not null then
            for item_record in
                select stock_item_id, quantity_requested
                from public.enprotec_workflow_items
                where workflow_request_id = new.id
            loop
                update public.enprotec_inventory
                set quantity_on_hand = quantity_on_hand - item_record.quantity_requested
                where stock_item_id = item_record.stock_item_id
                  and store = target_store;
            end loop;
        end if;
    end if;
    return new;
end;
$$ language plpgsql;
