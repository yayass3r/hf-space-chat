-- =============================================
-- SQL Migration: Upgrade profiles table
-- Adds comprehensive user profile fields
-- Run this in Supabase SQL Editor
-- Project: ucmpclgctjeyoimtmqir
-- =============================================

-- 1. Add new columns to profiles table (safe - IF NOT EXISTS equivalent via DO block)
DO $$
BEGIN
  -- Display name
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'display_name') THEN
    ALTER TABLE public.profiles ADD COLUMN display_name TEXT NOT NULL DEFAULT '';
  END IF;

  -- Avatar URL
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'avatar_url') THEN
    ALTER TABLE public.profiles ADD COLUMN avatar_url TEXT NOT NULL DEFAULT '';
  END IF;

  -- Bio
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'bio') THEN
    ALTER TABLE public.profiles ADD COLUMN bio TEXT NOT NULL DEFAULT '';
  END IF;

  -- Phone
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'phone') THEN
    ALTER TABLE public.profiles ADD COLUMN phone TEXT NOT NULL DEFAULT '';
  END IF;

  -- Website
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'website') THEN
    ALTER TABLE public.profiles ADD COLUMN website TEXT NOT NULL DEFAULT '';
  END IF;

  -- Location
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'location') THEN
    ALTER TABLE public.profiles ADD COLUMN location TEXT NOT NULL DEFAULT '';
  END IF;

  -- Language preference
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'language_preference') THEN
    ALTER TABLE public.profiles ADD COLUMN language_preference TEXT NOT NULL DEFAULT 'ar';
  END IF;

  -- Theme preference
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'theme_preference') THEN
    ALTER TABLE public.profiles ADD COLUMN theme_preference TEXT NOT NULL DEFAULT 'system';
  END IF;

  -- Notifications enabled
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'notifications_enabled') THEN
    ALTER TABLE public.profiles ADD COLUMN notifications_enabled BOOLEAN NOT NULL DEFAULT true;
  END IF;

  -- Last seen
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'last_seen') THEN
    ALTER TABLE public.profiles ADD COLUMN last_seen TIMESTAMPTZ;
  END IF;

  -- Updated at
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'updated_at') THEN
    ALTER TABLE public.profiles ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
  END IF;
END $$;

-- 2. Update the handle_new_user trigger function to include new fields
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, display_name, avatar_url, bio, phone, website, location, language_preference, theme_preference, notifications_enabled, last_seen, updated_at)
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
    COALESCE(NEW.raw_user_meta_data->>'display_name', ''),
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

-- 3. Create a function to update last_seen (can be called from client)
CREATE OR REPLACE FUNCTION public.update_last_seen()
RETURNS void AS $$
BEGIN
  UPDATE public.profiles
  SET last_seen = now(), updated_at = now()
  WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Add RLS policy for update_last_seen function (users can update their own last_seen)
-- The existing "Users can update own profile" policy already covers this

-- 5. Grant execute on update_last_seen to authenticated users
GRANT EXECUTE ON FUNCTION public.update_last_seen() TO authenticated;

-- 6. Set default display_name from email for existing users
UPDATE public.profiles
SET display_name = SPLIT_PART(email, '@', 1)
WHERE display_name = '' AND email != '';

-- =============================================
-- Verification query (run after to verify):
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'profiles'
-- ORDER BY ordinal_position;
-- =============================================
