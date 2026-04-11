-- =============================================
-- SQL Setup Script for HF Space Chat
-- Project: ucmpclgctjeyoimtmqir
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Create profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create site_settings table (key-value store for admin config)
CREATE TABLE IF NOT EXISTS public.site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

-- 3. Create projects table (for chat sessions)
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

-- 4. Create ai_chat_messages table (for chat messages)
CREATE TABLE IF NOT EXISTS public.ai_chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Insert default site settings
INSERT INTO public.site_settings (key, value) VALUES
  ('admin_emails', 'yayass3r@gmail.com'),
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

-- 6. Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies for profiles
-- Users can read their own profile
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Admins can read all profiles
CREATE POLICY "Admins can read all profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can update any profile
CREATE POLICY "Admins can update any profile" ON public.profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Allow insert on profile creation (for new user signup)
CREATE POLICY "Allow profile insert on signup" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 8. RLS Policies for site_settings
-- Anyone authenticated can read settings
CREATE POLICY "Authenticated users can read settings" ON public.site_settings
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only admins can write settings
CREATE POLICY "Admins can insert settings" ON public.site_settings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update settings" ON public.site_settings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 9. RLS Policies for projects (user-scoped)
-- Users can read their own projects
CREATE POLICY "Users can read own projects" ON public.projects
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own projects
CREATE POLICY "Users can insert own projects" ON public.projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own projects
CREATE POLICY "Users can update own projects" ON public.projects
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own projects
CREATE POLICY "Users can delete own projects" ON public.projects
  FOR DELETE USING (auth.uid() = user_id);

-- Admins can read all projects
CREATE POLICY "Admins can read all projects" ON public.projects
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 10. RLS Policies for ai_chat_messages
-- Users can read messages in their own projects
CREATE POLICY "Users can read own messages" ON public.ai_chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = ai_chat_messages.project_id AND user_id = auth.uid()
    )
  );

-- Users can insert messages in their own projects
CREATE POLICY "Users can insert own messages" ON public.ai_chat_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = ai_chat_messages.project_id AND user_id = auth.uid()
    )
  );

-- Admins can read all messages
CREATE POLICY "Admins can read all messages" ON public.ai_chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 11. Function to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
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
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Trigger for auto profile creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- After running this script:
-- 1. Go to Authentication → Providers → enable Email
-- 2. Go to Authentication → Settings → disable "Confirm email" for instant access
-- =============================================
