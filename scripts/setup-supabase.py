#!/usr/bin/env python3
"""Execute SQL setup script on Supabase PostgreSQL database."""

import psycopg2
import sys

DB_HOST = "aws-0-us-east-1.pooler.supabase.com"
DB_PORT = 6543
DB_NAME = "postgres"
DB_USER = "postgres.uuslujxtsrtbvjihcdzw"
DB_PASSWORD = "@1412Yasser@"

SQL_TABLES = """
-- 1. Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create site_settings table
CREATE TABLE IF NOT EXISTS public.site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

-- 3. Add user_id column to projects table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.projects ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 4. Insert default site settings
INSERT INTO public.site_settings (key, value) VALUES
  ('admin_emails', 'admin@example.com'),
  ('adsense_enabled', 'false'),
  ('adsense_client_id', ''),
  ('adsense_ad_slot', ''),
  ('admob_enabled', 'false'),
  ('admob_app_id', ''),
  ('admob_ad_unit_id', ''),
  ('site_name', 'HF Space Chat'),
  ('hf_space_url', 'https://your-space.hf.space'),
  ('hf_api_path', '/api/predict')
ON CONFLICT (key) DO NOTHING;
"""

SQL_RLS = """
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;
"""

SQL_DROP_POLICIES = """
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow profile insert on signup" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can read settings" ON public.site_settings;
DROP POLICY IF EXISTS "Admins can insert settings" ON public.site_settings;
DROP POLICY IF EXISTS "Admins can update settings" ON public.site_settings;
DROP POLICY IF EXISTS "Users can read own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can insert own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON public.projects;
DROP POLICY IF EXISTS "Admins can read all projects" ON public.projects;
DROP POLICY IF EXISTS "Users can read own messages" ON public.ai_chat_messages;
DROP POLICY IF EXISTS "Users can insert own messages" ON public.ai_chat_messages;
DROP POLICY IF EXISTS "Admins can read all messages" ON public.ai_chat_messages;
"""

SQL_CREATE_POLICIES = """
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can read all profiles" ON public.profiles
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins can update any profile" ON public.profiles
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Allow profile insert on signup" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Authenticated users can read settings" ON public.site_settings
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can insert settings" ON public.site_settings
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins can update settings" ON public.site_settings
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Users can read own projects" ON public.projects
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own projects" ON public.projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON public.projects
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON public.projects
  FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can read all projects" ON public.projects
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Users can read own messages" ON public.ai_chat_messages
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.projects WHERE id = ai_chat_messages.project_id AND user_id = auth.uid()));
CREATE POLICY "Users can insert own messages" ON public.ai_chat_messages
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE id = ai_chat_messages.project_id AND user_id = auth.uid()));
CREATE POLICY "Admins can read all messages" ON public.ai_chat_messages
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
"""

SQL_TRIGGER = """
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, NEW.email,
    CASE WHEN EXISTS (SELECT 1 FROM public.site_settings WHERE key = 'admin_emails' AND NEW.email = ANY(string_to_array(value, ','))) THEN 'admin' ELSE 'user' END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
"""

def run_step(cursor, sql, desc):
    try:
        cursor.execute(sql)
        print(f"  OK: {desc}")
        return True
    except Exception as e:
        print(f"  WARN: {desc} -> {e}")
        return False

def main():
    print("=" * 50)
    print("Supabase SQL Setup")
    print("=" * 50)

    conn = None
    attempts = [
        ("aws-0-us-east-1.pooler.supabase.com", 6543, "Pooler 6543"),
        ("aws-0-us-east-1.pooler.supabase.com", 5432, "Pooler 5432"),
        ("db.uuslujxtsrtbvjihcdzw.supabase.com", 5432, "Direct"),
    ]

    for host, port, desc in attempts:
        print(f"\nConnecting: {desc}...")
        try:
            conn = psycopg2.connect(host=host, port=port, dbname=DB_NAME,
                                     user=DB_USER, password=DB_PASSWORD, connect_timeout=15)
            conn.autocommit = True
            print(f"  Connected!")
            break
        except Exception as e:
            print(f"  Failed: {e}")

    if not conn:
        print("\nAll connections failed. Trying REST API verification...")
        try_rest()
        return

    cur = conn.cursor()

    print("\n--- Step 1: Create Tables ---")
    run_step(cur, SQL_TABLES, "profiles, site_settings, user_id column, default settings")

    print("\n--- Step 2: Enable RLS ---")
    run_step(cur, SQL_RLS, "RLS on all tables")

    print("\n--- Step 3: Drop Old Policies ---")
    run_step(cur, SQL_DROP_POLICIES, "cleaned old policies")

    print("\n--- Step 4: Create RLS Policies ---")
    run_step(cur, SQL_CREATE_POLICIES, "all RLS policies")

    print("\n--- Step 5: Create Auth Trigger ---")
    run_step(cur, SQL_TRIGGER, "handle_new_user function + trigger")

    print("\n--- Verification ---")
    cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;")
    print(f"  Tables: {[r[0] for r in cur.fetchall()]}")

    cur.execute("SELECT key, value FROM public.site_settings ORDER BY key;")
    rows = cur.fetchall()
    print(f"  Settings ({len(rows)}):")
    for r in rows:
        v = r[1][:40] + "..." if len(r[1]) > 40 else r[1]
        print(f"    {r[0]}: {v}")

    cur.execute("SELECT tablename, policyname FROM pg_policies WHERE schemaname='public' ORDER BY tablename, policyname;")
    policies = cur.fetchall()
    print(f"  Policies ({len(policies)}):")
    for p in policies:
        print(f"    {p[0]}.{p[1]}")

    cur.close()
    conn.close()
    print("\n" + "=" * 50)
    print("DONE!")

def try_rest():
    import urllib.request, json
    URL = "https://uuslujxtsrtbvjihcdzw.supabase.co"
    KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1c2x1anh0c3J0YnZqaWhjZHp3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDQ1MDI0NSwiZXhwIjoyMDU5ODI5MjQ1fQ.rTjXQxa1BLbJ0uOQaYYEwJpIJW1-MhFQ9iI4K5qMWSk"
    h = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}

    for table in ["profiles", "site_settings"]:
        try:
            req = urllib.request.Request(f"{URL}/rest/v1/{table}?select=*&limit=1", headers=h)
            urllib.request.urlopen(req, timeout=10)
            print(f"  {table}: EXISTS")
        except urllib.error.HTTPError as e:
            print(f"  {table}: NOT FOUND ({e.code})")
        except Exception as e:
            print(f"  {table}: ERROR ({e})")

    print("\nCannot create tables via REST. Use Supabase SQL Editor:")
    print("https://supabase.com/dashboard/project/uuslujxtsrtbvjihcdzw/sql")

if __name__ == "__main__":
    main()
