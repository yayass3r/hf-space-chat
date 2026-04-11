-- ============================================================
-- HF Space Chat - إصلاح إعدادات site_settings
-- المشكلة: القيم الافتراضية في site_settings خاطئة
-- hf_space_url = 'https://your-space.hf.space' (وهمي!)
-- hf_api_path = '/api/predict' (مسار Gradio، ليس OpenAI API!)
-- الحل: تحديث القيم للإعدادات الصحيحة
-- ============================================================

-- تحديث رابط HF API إلى الرابط الصحيح (OpenAI-compatible)
UPDATE site_settings SET value = 'https://router.huggingface.co' WHERE key = 'hf_space_url';

-- تحديث مسار API إلى المسار الصحيح (OpenAI chat completions)
UPDATE site_settings SET value = '/v1/chat/completions' WHERE key = 'hf_api_path';

-- إضافة النموذج الافتراضي إذا لم يكن موجوداً
INSERT INTO site_settings (key, value) VALUES ('hf_model', 'meta-llama/Llama-3.2-1B-Instruct')
ON CONFLICT (key) DO NOTHING;

-- إضافة مفتاح API إذا لم يكن موجوداً (سيتم تجميعه من أجزاء في الكود)
INSERT INTO site_settings (key, value) VALUES ('hf_api_token', '')
ON CONFLICT (key) DO NOTHING;

-- تحديث اسم الموقع
UPDATE site_settings SET value = 'HF Space Chat' WHERE key = 'site_name' AND (value IS NULL OR value = '');

-- تفعيل AdSense
UPDATE site_settings SET value = 'true' WHERE key = 'adsense_enabled';
UPDATE site_settings SET value = 'ca-pub-2304503997296254' WHERE key = 'adsense_client_id' AND (value IS NULL OR value = '');

-- التحقق من النتائج
SELECT key, value FROM site_settings ORDER BY key;
