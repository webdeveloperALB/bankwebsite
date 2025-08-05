-- 1. Disable RLS on all public tables
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT table_schema, table_name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ) LOOP
        EXECUTE format('ALTER TABLE %I.%I DISABLE ROW LEVEL SECURITY;', r.table_schema, r.table_name);
    END LOOP;
END $$;

-- 2. Drop all RLS policies on public tables
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I;', r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- 3. Disable RLS on storage.objects (MUST be run as a top-level statement)
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;

-- 4. Drop all RLS policies on storage.objects (also must be top-level)
DROP POLICY IF EXISTS "select objects" ON storage.objects;
DROP POLICY IF EXISTS "insert objects" ON storage.objects;
DROP POLICY IF EXISTS "update objects" ON storage.objects;
DROP POLICY IF EXISTS "delete objects" ON storage.objects;
