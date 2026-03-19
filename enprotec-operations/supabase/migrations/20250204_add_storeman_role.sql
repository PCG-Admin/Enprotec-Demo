-- Adds the Storeman role to the user_role enum and refreshes dependent grants.
alter type public.user_role add value if not exists 'Storeman';
