-- Migration: Performance Optimization - Add Missing Indexes
-- Date: 2026-01-20
-- Description: Adds critical indexes to improve query performance across the application.
--              Addresses slow loading times for stock items, workflows, and dropdowns.

-- ============================================================================
-- ENABLE EXTENSIONS FIRST
-- ============================================================================

-- Enable pg_trgm extension for faster text searches (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- STOCK ITEMS TABLE INDEXES
-- ============================================================================

-- Index for part_number lookups (used heavily in forms and searches)
CREATE INDEX IF NOT EXISTS idx_en_stock_items_part_number
ON public.enprotec_stock_items(part_number);

-- Index for description searches (LIKE queries) - requires pg_trgm extension
CREATE INDEX IF NOT EXISTS idx_en_stock_items_description
ON public.enprotec_stock_items USING gin(description gin_trgm_ops);

-- Index for category filtering
CREATE INDEX IF NOT EXISTS idx_en_stock_items_category
ON public.enprotec_stock_items(category);

-- Index for min_stock_level (used in low stock queries)
CREATE INDEX IF NOT EXISTS idx_en_stock_items_min_stock_level
ON public.enprotec_stock_items(min_stock_level);

-- ============================================================================
-- INVENTORY TABLE INDEXES
-- ============================================================================

-- Composite index for stock_item_id + store (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_en_inventory_stock_item_store
ON public.enprotec_inventory(stock_item_id, store);

-- Index for quantity_on_hand (used in low stock filtering)
CREATE INDEX IF NOT EXISTS idx_en_inventory_quantity_on_hand
ON public.enprotec_inventory(quantity_on_hand);

-- Index for location searches
CREATE INDEX IF NOT EXISTS idx_en_inventory_location
ON public.enprotec_inventory(location);

-- Composite index for store + quantity (for store-specific stock queries)
CREATE INDEX IF NOT EXISTS idx_en_inventory_store_quantity
ON public.enprotec_inventory(store, quantity_on_hand);

-- ============================================================================
-- WORKFLOW REQUESTS TABLE INDEXES
-- ============================================================================

-- Index for current_status (heavily filtered)
CREATE INDEX IF NOT EXISTS idx_en_workflow_requests_status
ON public.enprotec_workflow_requests(current_status);

-- Index for requester_id (for user-specific queries)
CREATE INDEX IF NOT EXISTS idx_en_workflow_requests_requester
ON public.enprotec_workflow_requests(requester_id);

-- Index for site_id (for site-specific filtering)
CREATE INDEX IF NOT EXISTS idx_en_workflow_requests_site
ON public.enprotec_workflow_requests(site_id);

-- Index for created_at (for date range queries and ordering)
CREATE INDEX IF NOT EXISTS idx_en_workflow_requests_created_at
ON public.enprotec_workflow_requests(created_at DESC);

-- Composite index for department + status (common filter combination)
CREATE INDEX IF NOT EXISTS idx_en_workflow_requests_dept_status
ON public.enprotec_workflow_requests(department, current_status);

-- Index for priority filtering
CREATE INDEX IF NOT EXISTS idx_en_workflow_requests_priority
ON public.enprotec_workflow_requests(priority);

-- ============================================================================
-- WORKFLOW ITEMS TABLE INDEXES
-- ============================================================================

-- Index for workflow_request_id (JOIN performance)
CREATE INDEX IF NOT EXISTS idx_en_workflow_items_request_id
ON public.enprotec_workflow_items(workflow_request_id);

-- Index for stock_item_id (JOIN performance)
CREATE INDEX IF NOT EXISTS idx_en_workflow_items_stock_item_id
ON public.enprotec_workflow_items(stock_item_id);

-- Composite index for both (optimizes view queries)
CREATE INDEX IF NOT EXISTS idx_en_workflow_items_request_stock
ON public.enprotec_workflow_items(workflow_request_id, stock_item_id);

-- ============================================================================
-- SITES TABLE INDEXES
-- ============================================================================

-- Index for status filtering (Active/Inactive)
CREATE INDEX IF NOT EXISTS idx_en_sites_status
ON public.enprotec_sites(status);

-- Index for name (used in ordering and searches)
CREATE INDEX IF NOT EXISTS idx_en_sites_name
ON public.enprotec_sites(name);

-- ============================================================================
-- USERS TABLE INDEXES
-- ============================================================================

-- Index for role filtering
CREATE INDEX IF NOT EXISTS idx_en_users_role
ON public.enprotec_users(role);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_en_users_status
ON public.enprotec_users(status);

-- Index for email lookups
CREATE INDEX IF NOT EXISTS idx_en_users_email
ON public.enprotec_users(email);

-- Composite index for status + role (common filter combination)
CREATE INDEX IF NOT EXISTS idx_en_users_status_role
ON public.enprotec_users(status, role);

-- ============================================================================
-- SALVAGE REQUESTS TABLE INDEXES
-- ============================================================================

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_en_salvage_requests_status
ON public.enprotec_salvage_requests(status);

-- Index for source_department
CREATE INDEX IF NOT EXISTS idx_en_salvage_requests_source_dept
ON public.enprotec_salvage_requests(source_department);

-- Index for created_by_id
CREATE INDEX IF NOT EXISTS idx_en_salvage_requests_created_by
ON public.enprotec_salvage_requests(created_by_id);

-- Index for stock_item_id
CREATE INDEX IF NOT EXISTS idx_en_salvage_requests_stock_item
ON public.enprotec_salvage_requests(stock_item_id);

-- Index for created_at (for date ordering)
CREATE INDEX IF NOT EXISTS idx_en_salvage_requests_created_at
ON public.enprotec_salvage_requests(created_at DESC);

-- ============================================================================
-- STOCK RECEIPTS TABLE INDEXES
-- ============================================================================

-- Index for received_at (date ordering)
CREATE INDEX IF NOT EXISTS idx_en_stock_receipts_received_at
ON public.enprotec_stock_receipts(received_at DESC);

-- Index for stock_item_id
CREATE INDEX IF NOT EXISTS idx_en_stock_receipts_stock_item
ON public.enprotec_stock_receipts(stock_item_id);

-- Index for received_by_id (user filtering)
CREATE INDEX IF NOT EXISTS idx_en_stock_receipts_received_by
ON public.enprotec_stock_receipts(received_by_id);

-- ============================================================================
-- WORKFLOW COMMENTS TABLE INDEXES
-- ============================================================================

-- Index for workflow_request_id (JOIN performance)
CREATE INDEX IF NOT EXISTS idx_en_workflow_comments_request_id
ON public.enprotec_workflow_comments(workflow_request_id);

-- Index for created_at (ordering)
CREATE INDEX IF NOT EXISTS idx_en_workflow_comments_created_at
ON public.enprotec_workflow_comments(created_at);

-- ============================================================================
-- ANALYZE TABLES FOR QUERY PLANNER
-- ============================================================================

-- Update table statistics to help PostgreSQL query planner
ANALYZE public.enprotec_stock_items;
ANALYZE public.enprotec_inventory;
ANALYZE public.enprotec_workflow_requests;
ANALYZE public.enprotec_workflow_items;
ANALYZE public.enprotec_users;
ANALYZE public.enprotec_sites;
ANALYZE public.enprotec_salvage_requests;
ANALYZE public.enprotec_stock_receipts;
ANALYZE public.enprotec_workflow_comments;
ANALYZE public.enprotec_departments;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON INDEX idx_en_stock_items_part_number IS 'Optimizes part number lookups in forms and searches';
COMMENT ON INDEX idx_en_stock_items_description IS 'Optimizes description LIKE searches using trigram matching';
COMMENT ON INDEX idx_en_inventory_stock_item_store IS 'Optimizes JOIN queries in stock views by store';
COMMENT ON INDEX idx_en_workflow_requests_dept_status IS 'Optimizes common workflow filtering by department and status';
COMMENT ON INDEX idx_en_workflow_items_request_stock IS 'Optimizes workflow items view joins';
