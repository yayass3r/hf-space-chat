-- ============================================================
-- HF Space Chat - إضافة جدول النشر (deployments)
-- يتضمن: جدول عمليات النشر + RLS + تحديثات projects
-- آمن للتشغيل المتكرر (idempotent)
-- ============================================================

-- 1. إنشاء جدول عمليات النشر
CREATE TABLE IF NOT EXISTS public.deployments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL DEFAULT '',
  provider_project_name TEXT NOT NULL DEFAULT '',
  deploy_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  error_message TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. إضافة عمود is_deployed و status لجدول projects إذا لم يكونا موجودين
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'is_deployed') THEN
    ALTER TABLE public.projects ADD COLUMN is_deployed BOOLEAN NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'status') THEN
    ALTER TABLE public.projects ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'deploy_url') THEN
    ALTER TABLE public.projects ADD COLUMN deploy_url TEXT NOT NULL DEFAULT '';
  END IF;
END $$;

-- 3. تفعيل RLS على جدول deployments
ALTER TABLE public.deployments ENABLE ROW LEVEL SECURITY;

-- 4. حذف السياسات القديمة على deployments
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'deployments'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.deployments', pol.policyname);
  END LOOP;
END $$;

-- 5. إنشاء سياسات RLS لجدول deployments
CREATE POLICY "users_read_own_deployments" ON public.deployments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_create_deployments" ON public.deployments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_delete_own_deployments" ON public.deployments
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "admins_full_access_deployments" ON public.deployments
  FOR ALL USING (public.is_admin());

-- 6. إنشاء فهرس لتسريع الاستعلامات
CREATE INDEX IF NOT EXISTS idx_deployments_user_id ON public.deployments(user_id);
CREATE INDEX IF NOT EXISTS idx_deployments_project_id ON public.deployments(project_id);

-- 7. التحقق من النتائج
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'deployments'
ORDER BY ordinal_position;

SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'deployments'
ORDER BY policyname;
