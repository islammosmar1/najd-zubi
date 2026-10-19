# تجهيز SEO والنشر

المشروع: Next.js App Router، مع Vinext للتشغيل المحلي الافتراضي.

## الدومين النهائي

اضبط NEXT_PUBLIC_SITE_URL في بيئة الاستضافة على الدومين النهائي HTTPS فقط، دون مسار أو معاملات، ثم أعد البناء والنشر. لا تضع localhost أو دومين المعاينة. لا يُستخدم أي دومين افتراضي. ملف .env.local محلي وغير مخصص للرفع.

حتى تضبط الدومين: تعمل الصفحات دون canonical، ولا يُعلن robots عن sitemap، ويعيد sitemap حالة 503 ورسالة إعداد. هذا مقصود لمنع إرسال روابط خاطئة إلى Google. اختبارات SEO تستخدم دومينًا وهميًا داخل الاختبارات فقط.

## الفحص

1. افتح /robots.txt على الدومين النهائي: يجب أن يعطي 200، ويسمح بالصفحات العامة ويعرض رابط sitemap بالدومين نفسه.
2. افتح /sitemap.xml: يجب أن يعطي 200 وXML فيه الرئيسية والمتجر والمنتجات المنشورة العامة فقط، دون منتجات العرض التجريبية أو الحسابات أو الطلبات. خطأ 503 بعد ضبط الدومين قد يدل على تعذر جلب الكتالوج.
3. اعرض مصدر الرئيسية و/shop وصفحة منتج منشور: تحقق من title وdescription وcanonical وog:url. يجب أن تكون الروابط على الدومين النهائي، وألا تحمل الصفحات العامة noindex.
4. افتح /shop?admin=1 و/shop?track=1 و/shop?cart=1 و/shop?wishlist=1: هذه الحالات تحمل noindex. ترك الزحف لها متاحًا يتيح لمحرك البحث قراءة noindex؛ robots ليس حماية للبيانات، والصلاحيات ما زالت على الخادم.
5. سجّل الموقع في Google Search Console، وأثبت ملكية الدومين، وأرسل sitemap.xml، ثم استخدم فحص الرابط للرئيسية ومنتج. لا توجد ضمانة لسرعة الفهرسة أو الترتيب.
6. شغّل npm test وnpm run typecheck وnpm run build. عند النشر على Vercel استخدم إعداد المشروع الموجود الذي يشغّل build:vercel.

## رفع GitHub

المجلد الحالي على D ليس مستودع Git. إذا لديك مستودع قائم: استنسخه إلى مجلد منفصل ثم انسخ ملفات المصدر المعدّلة إليه دون استبدال .git أو ملفات البيئة، وراجع git diff قبل commit وpush. لا تنشئ مستودعًا ثانيًا فوق نسخة مرتبطة أصلًا.

لمستودع جديد فارغ: أنشئ مستودعًا خاصًا على GitHub ثم نفّذ داخل مجلد المشروع:

```powershell
git init -b main
git add .gitignore .env.example app lib components hooks public db drizzle supabase scripts tests docs vendor build .openai package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.json next.config.ts vite.config.ts vercel.json postcss.config.mjs eslint.config.mjs components.json cloudflare-env.d.ts drizzle.config.ts README.md
git diff --cached --stat
git diff --cached
git commit -m "Prepare store SEO and fix wholesale account CORS"
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

استبدل YOUR_GITHUB_REPOSITORY_URL برابط مستودعك. راجع الملفات المرحّلة قبل commit؛ لا ترفع ملفات .env الحقيقية أو مفاتيح service_role أو سجلات العملاء أو نسخ قواعد البيانات. .env.example قالب بلا أسرار. git push وحده لا يضبط متغيرات الاستضافة أو ينشر وظائف Supabase؛ إصلاح wholesale-accounts نُشر مباشرة إلى Supabase في هذه المهمة.

## حسابات الجملة

أُصلح اختلاف CORS لعنوانَي http://127.0.0.1:5173 وhttp://localhost:5173، مع الاحتفاظ بالدومين المضبوط في ALLOWED_ORIGIN. لا توجد سماحية شاملة لجميع الدومينات. بقي التحقق من جلسة المدير وصلاحية staff.manage.

للتجربة: سجّل دخول المدير، وأنشئ حسابًا باسم صحيح وهاتف دولي يبدأ بـ +970 أو +972 وكلمة مرور 12 حرفًا على الأقل. الرقم المكرر يُرفض. عند النشر اضبط ALLOWED_ORIGIN في Supabase للدومين النهائي أيضًا.
