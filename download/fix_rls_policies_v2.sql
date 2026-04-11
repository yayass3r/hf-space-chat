-- ============================================================
-- إصلاح إضافي: منح صلاحية قراءة auth.users للسياسات العامة
-- المشكلة: RLS policies تستعلم auth.users لكن anon role ليس لديه صلاحية
-- الخطأ: 42501 - permission denied for table users
-- ============================================================

-- 1. منح صلاحية SELECT على auth.users للدور anon و authenticated
-- هذا ضروري لكي تعمل سياسات RLS التي تتحقق من دور المستخدم
GRANT SELECT ON auth.users TO anon, authenticated;

-- 2. بدائل أكثر أماناً: إذا كنت لا تريد منح صلاحية كاملة على auth.users
-- يمكنك إنشاء دالة مساعدة بـ SECURITY DEFINER بدلاً من ذلك
-- (الخيار أدناه أكثر أماناً لكن يتطلب تغيير السياسات أيضاً)

-- إنشاء دالة مساعدة للتحقق من كون المستخدم مسؤولاً
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND (
      auth.users.raw_user_meta_data ->> 'role' = 'admin'
      OR auth.users.raw_app_meta_data ->> 'role' = 'admin'
      OR auth.users.email IN (
        SELECT value FROM public.site_settings 
        WHERE key = 'admin_emails'
      )
    )
  );
$$;

-- 3. تحديث سياسات profiles لاستخدام الدالة المساعدة بدلاً من الاستعلام المباشر
-- حذف السياسات الحالية أولاً
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON profiles', pol.policyname);
  END LOOP;
END $$;

-- إنشاء سياسات جديدة باستخدام الدالة المساعدة
CREATE POLICY "users_read_own_profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_update_own_profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "users_insert_own_profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "admins_full_access_profiles" ON profiles
  FOR ALL USING (public.is_admin());


-- 4. تحديث سياسات projects
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'projects'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON projects', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "users_read_own_projects" ON projects
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_create_projects" ON projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_projects" ON projects
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "users_delete_own_projects" ON projects
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "admins_full_access_projects" ON projects
  FOR ALL USING (public.is_admin());


-- 5. تحديث سياسات ai_chat_messages
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ai_chat_messages'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON ai_chat_messages', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "users_read_own_messages" ON ai_chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = ai_chat_messages.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "users_create_messages" ON ai_chat_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = ai_chat_messages.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "users_delete_own_messages" ON ai_chat_messages
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = ai_chat_messages.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "admins_full_access_messages" ON ai_chat_messages
  FOR ALL USING (public.is_admin());


-- 6. تحديث سياسات site_settings
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'site_settings'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON site_settings', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "public_read_settings" ON site_settings
  FOR SELECT USING (true);

CREATE POLICY "admins_manage_settings" ON site_settings
  FOR ALL USING (public.is_admin());


-- 7. التأكد من أن RLS مفعل
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;


-- ✅ تحقق من النتائج
SELECT 
  'profiles' as t, count(*) as p FROM pg_policies WHERE tablename = 'profiles'
UNION ALL SELECT 'projects', count(*) FROM pg_policies WHERE tablename = 'projects'
UNION ALL SELECT 'ai_chat_messages', count(*) FROM pg_policies WHERE tablename = 'ai_chat_messages'
UNION ALL SELECT 'site_settings', count(*) FROM pg_policies WHERE tablename = 'site_settings'
UNION ALL SELECT 'is_admin function', 1 WHERE EXISTS (
  SELECT 1 FROM pg_proc WHERE proname = 'is_admin' AND pronamespace = 'public'::regnamespace
);
