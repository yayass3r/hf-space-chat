-- ============================================================
-- HF Space Chat - إعداد قاعدة البيانات الشامل
-- يتضمن: حقول الملف الشخصي + إصلاح RLS + إعدادات API
-- المشروع: ucmpclgctjeyoimtmqir
-- انسخ هذا الملف بالكامل والصقه في Supabase SQL Editor
-- آمن للتشغيل المتكرر (idempotent)
-- ============================================================


-- ============================================================
-- القسم 1: إنشاء الجداول إذا لم تكن موجودة
-- ============================================================

-- جدول الملفات الشخصية (يمتد auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  display_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  language_preference TEXT NOT NULL DEFAULT 'ar',
  theme_preference TEXT NOT NULL DEFAULT 'system',
  notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  last_seen TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- جدول إعدادات الموقع (مخزن key-value)
CREATE TABLE IF NOT EXISTS public.site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

-- جدول المشاريع/المحادثات
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'New Chat',
  template TEXT NOT NULL DEFAULT 'chat',
  is_public BOOLEAN NOT NULL DEFAULT false,
  is_deployed BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active',
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- جدول رسائل المحادثة
CREATE TABLE IF NOT EXISTS public.ai_chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================
-- القسم 2: إضافة الحقول الجديدة للملف الشخصي (آمن - يتحقق أولاً)
-- ============================================================

DO $$
BEGIN
  -- الاسم المعروض
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'display_name') THEN
    ALTER TABLE public.profiles ADD COLUMN display_name TEXT NOT NULL DEFAULT '';
  END IF;

  -- رابط الصورة الشخصية
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'avatar_url') THEN
    ALTER TABLE public.profiles ADD COLUMN avatar_url TEXT NOT NULL DEFAULT '';
  END IF;

  -- نبذة عني
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'bio') THEN
    ALTER TABLE public.profiles ADD COLUMN bio TEXT NOT NULL DEFAULT '';
  END IF;

  -- رقم الهاتف
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'phone') THEN
    ALTER TABLE public.profiles ADD COLUMN phone TEXT NOT NULL DEFAULT '';
  END IF;

  -- الموقع الإلكتروني
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'website') THEN
    ALTER TABLE public.profiles ADD COLUMN website TEXT NOT NULL DEFAULT '';
  END IF;

  -- الموقع الجغرافي
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'location') THEN
    ALTER TABLE public.profiles ADD COLUMN location TEXT NOT NULL DEFAULT '';
  END IF;

  -- لغة الواجهة
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'language_preference') THEN
    ALTER TABLE public.profiles ADD COLUMN language_preference TEXT NOT NULL DEFAULT 'ar';
  END IF;

  -- تفضيل السمة (فاتح/داكن/تلقائي)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'theme_preference') THEN
    ALTER TABLE public.profiles ADD COLUMN theme_preference TEXT NOT NULL DEFAULT 'system';
  END IF;

  -- تفعيل الإشعارات
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'notifications_enabled') THEN
    ALTER TABLE public.profiles ADD COLUMN notifications_enabled BOOLEAN NOT NULL DEFAULT true;
  END IF;

  -- آخر نشاط
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'last_seen') THEN
    ALTER TABLE public.profiles ADD COLUMN last_seen TIMESTAMPTZ;
  END IF;

  -- تاريخ التحديث
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'updated_at') THEN
    ALTER TABLE public.profiles ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
  END IF;
END $$;


-- ============================================================
-- القسم 3: تحديث display_name للمستخدمين الحاليين من البريد الإلكتروني
-- ============================================================

UPDATE public.profiles
SET display_name = SPLIT_PART(email, '@', 1)
WHERE display_name = '' AND email IS NOT NULL AND email != '';


-- ============================================================
-- القسم 4: إنشاء الدوال المساعدة
-- ============================================================

-- دالة التحقق من كون المستخدم مسؤولاً (تستخدم SECURITY DEFINER لتجنب التكرار اللانهائي)
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
      auth.users.email IN (
        SELECT value FROM public.site_settings
        WHERE key = 'admin_emails'
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
      )
    )
  );
$$;

-- دالة تحديث آخر نشاط للمستخدم الحالي
CREATE OR REPLACE FUNCTION public.update_last_seen()
RETURNS void AS $$
BEGIN
  UPDATE public.profiles
  SET last_seen = now(), updated_at = now()
  WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- منح صلاحية التنفيذ للمستخدمين المسجلين
GRANT EXECUTE ON FUNCTION public.update_last_seen() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- منح صلاحية قراءة auth.users للسياسات
GRANT SELECT ON auth.users TO anon, authenticated;


-- ============================================================
-- القسم 5: تحديث دالة إنشاء الملف الشخصي تلقائياً عند التسجيل
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id, email, role,
    display_name, avatar_url, bio, phone, website, location,
    language_preference, theme_preference, notifications_enabled,
    last_seen, updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM public.site_settings
        WHERE key = 'admin_emails'
        AND NEW.email = ANY(string_to_array(value, ','))
      ) THEN 'admin'
      ELSE 'user'
    END,
    COALESCE(NEW.raw_user_meta_data->>'display_name', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    '',
    '',
    '',
    '',
    'ar',
    'system',
    true,
    now(),
    now()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- إنشاء الـ trigger إذا لم يكن موجوداً
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- القسم 6: إصلاح سياسات الأمان (RLS) - بدون تكرار لانهائي
-- ============================================================

-- تفعيل RLS على جميع الجداول
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;

-- حذف جميع السياسات القديمة على profiles
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
  END LOOP;
END $$;

-- سياسات profiles الجديدة
CREATE POLICY "users_read_own_profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_update_own_profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "users_insert_own_profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "admins_full_access_profiles" ON public.profiles
  FOR ALL USING (public.is_admin());


-- حذف جميع السياسات القديمة على projects
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'projects'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.projects', pol.policyname);
  END LOOP;
END $$;

-- سياسات projects الجديدة
CREATE POLICY "users_read_own_projects" ON public.projects
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_create_projects" ON public.projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_projects" ON public.projects
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "users_delete_own_projects" ON public.projects
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "admins_full_access_projects" ON public.projects
  FOR ALL USING (public.is_admin());


-- حذف جميع السياسات القديمة على ai_chat_messages
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ai_chat_messages'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.ai_chat_messages', pol.policyname);
  END LOOP;
END $$;

-- سياسات ai_chat_messages الجديدة
CREATE POLICY "users_read_own_messages" ON public.ai_chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE public.projects.id = ai_chat_messages.project_id
      AND public.projects.user_id = auth.uid()
    )
  );

CREATE POLICY "users_create_messages" ON public.ai_chat_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE public.projects.id = ai_chat_messages.project_id
      AND public.projects.user_id = auth.uid()
    )
  );

CREATE POLICY "users_delete_own_messages" ON public.ai_chat_messages
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE public.projects.id = ai_chat_messages.project_id
      AND public.projects.user_id = auth.uid()
    )
  );

CREATE POLICY "admins_full_access_messages" ON public.ai_chat_messages
  FOR ALL USING (public.is_admin());


-- حذف جميع السياسات القديمة على site_settings
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'site_settings'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.site_settings', pol.policyname);
  END LOOP;
END $$;

-- سياسات site_settings الجديدة
CREATE POLICY "public_read_settings" ON public.site_settings
  FOR SELECT USING (true);

CREATE POLICY "admins_manage_settings" ON public.site_settings
  FOR ALL USING (public.is_admin());


-- ============================================================
-- القسم 7: إصلاح إعدادات site_settings
-- ============================================================

-- تحديث رابط HF API إلى الرابط الصحيح
UPDATE public.site_settings SET value = 'https://router.huggingface.co' WHERE key = 'hf_space_url';

-- تحديث مسار API إلى المسار الصحيح
UPDATE public.site_settings SET value = '/v1/chat/completions' WHERE key = 'hf_api_path';

-- إضافة/تحديث الإعدادات المفقودة
INSERT INTO public.site_settings (key, value) VALUES ('hf_model', 'meta-llama/Llama-3.2-1B-Instruct')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO public.site_settings (key, value) VALUES ('hf_api_token', '')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.site_settings (key, value) VALUES ('admin_emails', 'yayass3r@gmail.com')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO public.site_settings (key, value) VALUES ('site_name', 'HF Space Chat')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO public.site_settings (key, value) VALUES ('adsense_enabled', 'true')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO public.site_settings (key, value) VALUES ('adsense_client_id', 'ca-pub-2304503997296254')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO public.site_settings (key, value) VALUES ('adsense_ad_slot', '')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.site_settings (key, value) VALUES ('admob_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.site_settings (key, value) VALUES ('admob_app_id', '')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.site_settings (key, value) VALUES ('admob_ad_unit_id', '')
ON CONFLICT (key) DO NOTHING;


-- ============================================================
-- القسم 8: التحقق من النتائج
-- ============================================================

-- عرض أعمدة جدول profiles
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles'
ORDER BY ordinal_position;

-- عرض سياسات RLS
SELECT tablename, policyname, permissive, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- عرض إعدادات الموقع
SELECT key, value FROM public.site_settings ORDER BY key;

-- عرض عدد المستخدمين
SELECT count(*) as total_users FROM public.profiles;
