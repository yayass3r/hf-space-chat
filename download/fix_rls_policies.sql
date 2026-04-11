-- ============================================================
-- HF Space Chat - إصلاح سياسات RLS (Row Level Security)
-- المشكلة: حلقة لا نهائية (infinite recursion) في policies جدول profiles
-- السبب: السياسات تستعلم عن جدول profiles نفسه للتحقق من الصلاحيات
-- الحل: استخدام auth.uid() مباشرة و JWT claims للتحقق من المسؤولين
-- ============================================================

-- 1️⃣ إصلاح جدول profiles
-- حذف جميع السياسات القديمة التي تسبب الحلقة اللانهائية
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON profiles;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON profiles;
DROP POLICY IF EXISTS "Enable select for users based on user_id" ON profiles;
DROP POLICY IF EXISTS "Service role can do everything" ON profiles;
DROP POLICY IF EXISTS "Allow public read access" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
-- حذف أي سياسات أخرى قد تكون موجودة
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

-- إنشاء سياسات جديدة بدون استعلام ذاتي (no self-reference)
-- المستخدم يمكنه رؤية وتعديل ملفه الشخصي فقط
CREATE POLICY "users_read_own_profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_update_own_profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- المستخدم الجديد يمكنه إنشاء ملفه الشخصي
CREATE POLICY "users_insert_own_profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- المسؤولون يمكنهم رؤية وتعديل جميع الملفات (باستخدام JWT claims)
-- هذا يتجنب الحلقة اللانهائية لأنه لا يستعلم عن جدول profiles
CREATE POLICY "admins_full_access_profiles" ON profiles
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'admin'
    OR EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (
        auth.users.raw_user_meta_data ->> 'role' = 'admin'
        OR auth.users.email = 'yayass3r@gmail.com'
      )
    )
  );


-- 2️⃣ إصلاح جدول projects
DROP POLICY IF EXISTS "Users can view own projects" ON projects;
DROP POLICY IF EXISTS "Users can create projects" ON projects;
DROP POLICY IF EXISTS "Users can update own projects" ON projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON projects;
DROP POLICY IF EXISTS "Admins can view all projects" ON projects;
DROP POLICY IF EXISTS "Enable read access for all users" ON projects;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON projects;
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
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (
        auth.users.raw_user_meta_data ->> 'role' = 'admin'
        OR auth.users.email = 'yayass3r@gmail.com'
      )
    )
  );


-- 3️⃣ إصلاح جدول ai_chat_messages
DROP POLICY IF EXISTS "Users can view own messages" ON ai_chat_messages;
DROP POLICY IF EXISTS "Users can create messages" ON ai_chat_messages;
DROP POLICY IF EXISTS "Admins can view all messages" ON ai_chat_messages;
DROP POLICY IF EXISTS "Enable read access for all users" ON ai_chat_messages;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON ai_chat_messages;
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

-- المستخدم يرى رسائل مشاريعه فقط
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
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (
        auth.users.raw_user_meta_data ->> 'role' = 'admin'
        OR auth.users.email = 'yayass3r@gmail.com'
      )
    )
  );


-- 4️⃣ إصلاح جدول site_settings (عام للقراءة، مسؤول للكتابة)
DROP POLICY IF EXISTS "Anyone can read settings" ON site_settings;
DROP POLICY IF EXISTS "Admins can manage settings" ON site_settings;
DROP POLICY IF EXISTS "Enable read access for all users" ON site_settings;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON site_settings;
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

-- القراءة متاحة للجميع (حتى غير المسجلين يحتاجون قراءة الإعدادات)
CREATE POLICY "public_read_settings" ON site_settings
  FOR SELECT USING (true);

-- الكتابة للمسؤولين فقط
CREATE POLICY "admins_manage_settings" ON site_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (
        auth.users.raw_user_meta_data ->> 'role' = 'admin'
        OR auth.users.email = 'yayass3r@gmail.com'
      )
    )
  );


-- 5️⃣ التأكد من أن RLS مفعل على جميع الجداول
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;


-- 6️⃣ إنشاء trigger لإنشاء ملف شخصي تلقائياً عند تسجيل مستخدم جديد
-- حذف الدالة والـ trigger القديمين إذا كانا موجودين
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    CASE
      WHEN NEW.email = 'yayass3r@gmail.com' THEN 'admin'
      ELSE 'user'
    END,
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ✅ انتهى الإصلاح! تحقق من النتائج:
SELECT 'profiles' as table_name, count(*) as policies FROM pg_policies WHERE tablename = 'profiles'
UNION ALL
SELECT 'projects', count(*) FROM pg_policies WHERE tablename = 'projects'
UNION ALL
SELECT 'ai_chat_messages', count(*) FROM pg_policies WHERE tablename = 'ai_chat_messages'
UNION ALL
SELECT 'site_settings', count(*) FROM pg_policies WHERE tablename = 'site_settings';
