'use client';
import type { Lang,Product,Settings } from '../lib/catalog';
export default function StoreChecklist({products,settings,lang,open}:{products:Product[];settings:Settings;lang:Lang;open:(tab:string)=>void}){
 const t=(a:string,b:string,c:string)=>lang==='ar'?a:lang==='en'?b:c;
 const published=products.filter(p=>p.status==='published'&&!p.isSample);
 const missingNames=published.filter(p=>!p.name.en||!p.name.he||p.name.en===p.name.ar||p.name.he===p.name.ar).length;
 const missingDetails=published.filter(p=>!p.images.length||!p.description.ar?.trim()).length;
 const noStock=published.filter(p=>p.stock<=0).length;
 const checks=[{ok:/^[1-9]\d{7,14}$/.test(settings.whatsapp),tab:'settings',text:t('رقم WhatsApp بصيغة دولية','International WhatsApp number','מספר WhatsApp בינלאומי')},{ok:published.some(p=>p.stock>0),tab:'products',text:t('منتجات فعلية متوفرة للبيع','Real products available for sale','מוצרים אמיתיים זמינים למכירה')},{ok:!missingNames,tab:'products',text:t(`أسماء اللغات تحتاج مراجعة: ${missingNames}`,`Names needing language review: ${missingNames}`,`שמות לבדיקת שפות: ${missingNames}`)},{ok:!missingDetails,tab:'products',text:t(`منتجات ينقصها وصف أو صورة: ${missingDetails}`,`Products missing description or image: ${missingDetails}`,`מוצרים ללא תיאור או תמונה: ${missingDetails}`)},{ok:settings.cities.some(c=>c.enabled!==false&&Number.isFinite(c.fee)&&c.fee>=0),tab:'delivery',text:t('مدينة توصيل مفعّلة برسوم صحيحة','Enabled delivery city with valid fee','עיר משלוח פעילה עם מחיר תקין')},{ok:!noStock,tab:'products',text:t(`منتجات منشورة نفدت: ${noStock}`,`Published products out of stock: ${noStock}`,`מוצרים שפורסמו ואזלו: ${noStock}`)}];
 return <div className="panel store-checklist"><h3>{t('ما الذي يحتاج انتباهك؟','What needs your attention?','מה דורש תשומת לב?')}</h3><p>{t('فحص سريع لبيانات المتجر، وليس اعتمادًا أمنيًا. اضغطي على البند لمراجعته.','A quick store data check, not a security certification. Select an item to review.','בדיקה מהירה של נתוני החנות, לא אישור אבטחה. לחצו לבדיקה.')}</p>{checks.map(c=><button key={c.text} onClick={()=>open(c.tab)}><span>{c.ok?'✓':'!'} {c.text}</span><span>←</span></button>)}</div>
}
