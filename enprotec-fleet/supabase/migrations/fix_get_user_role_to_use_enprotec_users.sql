-- =============================================================
--  Fix get_user_role() so RLS policies work for admins
--
--  Problem: RLS policies call get_user_role() which only read
--  from the `profiles` table. But fleet users are stored in
--  `en_users`, so admins were getting NULL / Driver and
--  being blocked from inserting vehicles etc.
--
--  Fix: check en_users first, fall back to profiles.
--  Run once in Supabase SQL Editor.
-- =============================================================

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT COALESCE(
    (SELECT role::TEXT FROM public.en_users  WHERE id = auth.uid()),
    (SELECT role::TEXT FROM public.profiles  WHERE id = auth.uid())
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;
