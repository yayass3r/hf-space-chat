---
Task ID: 1
Agent: Main Agent
Task: مراجعة شاملة وإصلاح أخطاء مشروع HF Space Chat

Work Log:
- قراءة جميع ملفات المشروع (8 ملفات أساسية + ملفات التكوين)
- تحديد 12 مشكلة حرجة ومتوسطة
- إصلاح HF API endpoint من api-inference.huggingface.co (معطل) إلى router.huggingface.co (الجديد)
- إضافة HF API Token إلى .env كـ NEXT_PUBLIC_HF_API_TOKEN
- إصلاح تكرار SiteSettings و DEFAULT_SETTINGS بين types.ts و supabase.ts
- إصلاح خطأ منطقي: زر إعادة المحاولة لا يظهر أبداً بسبب شرط خاطئ
- إصلاح retryLastMessage لاستخدام البث المباشر بدلاً من JSON عادي
- استخراج منطق البث المباشر إلى دالة قابلة لإعادة الاستخدام fetchStreamingResponse
- إصلاح معالجة SSE buffer المتبقي بعد انتهاء القراءة
- إزالة تحميل مزدوج لسكريبت AdSense من AdBanner.tsx
- تثبيت وإضافة @tailwindcss/typography لـ prose classes في MarkdownMessage
- إضافة inline script في layout.tsx لمنع FOUC (وميض الوضع المظلم)
- تغيير قائمة النماذج من hover إلى click للموبايل
- إضافة زر معلومات الاتصال في header
- إضافة دعم الوضع المظلم/الفاتح في AdminDashboard
- تحديث قائمة النماذج لـ HF Router API (8 نماذج مجانية/رخيصة)
- إصلاح جميع أخطاء ESLint في ملفات المشروع
- البناء ناجح و lint نظيف

Stage Summary:
- جميع الأخطاء الحرجة تم إصلاحها
- HF Router API يعمل مع النماذج: Llama 3.2 1B, Qwen3 8B, Llama 3.1 8B, Qwen Coder 7B, etc.
- البناء ناجح: `bun run build` ✓
- Lint نظيف: لا أخطاء في src/
