-- Run this in Supabase SQL Editor to find problematic triggers

-- 1. Check for triggers on en_inventory
SELECT
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE event_object_table IN ('en_inventory', 'en_stock_receipts')
ORDER BY event_object_table, trigger_name;

-- 2. Check for any functions that reference stock_movements
SELECT
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND pg_get_functiondef(p.oid) LIKE '%en_stock_movements%'
ORDER BY p.proname;
