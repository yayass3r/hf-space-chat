-- ============================================================
-- HF Space Chat - إضافة جدول اتصالات المستخدمين (user_connections)
-- يخزن بيانات ربط الاستضافة وقواعد البيانات لكل مستخدم
-- آمن للتشغيل المتكرر (idempotent)
-- ============================================================

-- 1. إنشاء جدول اتصالات المستخدمين
CREATE TABLE IF NOT EXISTS public.user_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider_type TEXT NOT NULL CHECK (provider_type IN ('hosting', 'database')),
  provider_id TEXT NOT NULL,
  credentials JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- ضمان عدم تكرار نفس الموفر لنفس المستخدم
  UNIQUE(user_id, provider_type, provider_id)
);

-- 2. تفعيل RLS على جدول user_connections
ALTER TABLE public.user_connections ENABLE ROW LEVEL SECURITY;

-- 3. حذف السياسات القديمة على user_connections (آمن للتشغيل المتكرر)
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_connections'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_connections', pol.policyname);
  END LOOP;
END $$;

-- 4. إنشاء سياسات RLS لجدول user_connections
-- المستخدم يرى اتصالاته فقط
CREATE POLICY "users_read_own_connections" ON public.user_connections
  FOR SELECT USING (auth.uid() = user_id);

-- المستخدم ينشئ اتصالاته فقط
CREATE POLICY "users_create_connections" ON public.user_connections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- المستخدم يحدث اتصالاته فقط
CREATE POLICY "users_update_own_connections" ON public.user_connections
  FOR UPDATE USING (auth.uid() = user_id);

-- المستخدم يحذف اتصالاته فقط
CREATE POLICY "users_delete_own_connections" ON public.user_connections
  FOR DELETE USING (auth.uid() = user_id);

-- المسؤول لديه صلاحية كاملة
CREATE POLICY "admins_full_access_connections" ON public.user_connections
  FOR ALL USING (public.is_admin());

-- 5. إنشاء فهرس لتسريع الاستعلامات
CREATE INDEX IF NOT EXISTS idx_user_connections_user_id ON public.user_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_user_connections_provider_type ON public.user_connections(provider_type);

-- 6. إنشاء دالة لتحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION public.update_user_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. إنشاء trigger لتحديث updated_at
DROP TRIGGER IF EXISTS trigger_update_user_connections_updated_at ON public.user_connections;
CREATE TRIGGER trigger_update_user_connections_updated_at
  BEFORE UPDATE ON public.user_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_connections_updated_at();

-- 8. التحقق من النتائج
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'user_connections'
ORDER BY ordinal_position;

SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'user_connections'
ORDER BY policyname;
