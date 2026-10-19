> **Latest complete handoff — 2026-10-17:** Start with [START-HERE-AR.md](START-HERE-AR.md) for VS Code, admin controls and the tested Next.js/Vercel build path. Older audit reports remain historical. This source has not been deployed automatically.

# NAJD COSMETICS

React + Vite (Vinext) + Framer Motion، مع Supabase للبيانات والمصادقة وتخزين الصور. العربية والإنجليزية والعبرية، RTL/LTR، ومظهر فاتح وداكن.

دليل VS Code وWindows: [START-HERE-AR.md](START-HERE-AR.md).

## التشغيل المحلي

Node.js 22.13+ وpnpm:

```bash
pnpm install
pnpm dev
```

```bash
pnpm build
node node_modules/typescript/bin/tsc --noEmit
node tests/cart.test.mjs
node tests/taxonomy.test.mjs
node tests/database.test.mjs
```

المشروع مربوط بمشروع Supabase الخاص بنجد بواسطة عنوان ومفتاح publishable عامين في `lib/public-config.ts`. لتشغيله على مشروع آخر، اضبط متغيرات `.env.example` ونفّذ ملفات migrations بالترتيب. لا تنفّذ migrations مرة أخرى على المشروع الحالي. ملف seed اختياري تجريبي ولم يُستخدم لإضافة منتجات وهمية إلى المشروع الفعلي.

## الإدارة

المسار `/admin`. أنشئ أول مستخدم من Supabase → Authentication → Users → Add user ببريد مالك الموقع، ثم سجّل الدخول بكلمة مرور تختارها أنت. الخادم يمنح صلاحية المدير الأول فقط للحساب ذي البريد المؤكد المطابق، ولا يمنحها تلقائيًا للزوار أو لأي حساب آخر.

أضف المدن ورسوم التوصيل ورقم WhatsApp، ثم البراندات والمنتجات. فعّل خيار «إظهار المنتج في المتجر بعد الحفظ». الأقسام والبراندات لها إدارة مستقلة للإضافة والترتيب والإخفاء. الأدوات المتقدمة تجمع التقارير والعملاء والموظفين والإعدادات الأخرى.

## حالة الربط

قاعدة البيانات وخدمة checkout متصلتان فعليًا. الأسعار والمخزون والكوبونات تُحسب على الخادم. الدفع المتاح عند الاستلام، ولا توجد بوابة بطاقات مفعّلة. مساعد الكتالوج المجاني يعمل دون API مدفوع، مع نموذج محلي اختياري عبر WebGPU. خدمة Beauty AI السحابية غير مفعلة، ولا يحتاج المساعد الأساسي إلى تفعيلها.

رفع الصور يحتاج تسجيل دخول وصلاحية المنتجات. لم يُختبر رفع ملف ناجح بحساب المالك بعد. اختبارات SQL وHTTP موثقة في `docs/SUPABASE-ACTIVATION.md`، بما فيها سجل اختبار HTTP ملغي ومنتج اختبار مخفي بقيا بعد تعذّر عملية حذفهِما عبر الموصّل. اختبار المتصفح والجوال ما زال مطلوبًا.

صور الصفحة الرئيسية صور إعلانية مولّدة وليست توثيقًا لمخزون فعلي. لا توجد أسعار توصيل أو منتجات افتراضية منشورة. إعدادات الشحن والتواصل والسياسات التجارية تحتاج بيانات المالك قبل استقبال زبائن فعليين.

تكامل النشر Sites/Cloudflare Workers موجود في `build/`؛ احتفظ به عند النشر على Sites. أسرار OpenAI وservice_role تبقى على الخادم ولا توضع في كود المتصفح.
