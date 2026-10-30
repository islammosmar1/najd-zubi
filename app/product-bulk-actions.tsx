'use client';
import {useState} from 'react';
import type {Lang,Product} from '../lib/catalog';
type Props={products:Product[];visible:Product[];selected:string[];setSelected:(ids:string[])=>void;busy:boolean;setBusy:(busy:boolean)=>void;lang:Lang;canWrite:boolean;save:(p:Product)=>Promise<void>;remove:(p:Product)=>Promise<void>;toast:(message:string)=>void};
export default function ProductBulkActions({products,visible,selected,setSelected,busy,setBusy,lang,canWrite,save,remove,toast}:Props){
 const [action,setAction]=useState('');
 const t=(ar:string,en:string,he:string)=>lang==='ar'?ar:lang==='he'?he:en;
 const rows=products.filter(p=>selected.includes(p.id));
 const all=visible.length>0&&visible.every(p=>selected.includes(p.id));
 async function apply(){
  if(busy||!action||!rows.length||!canWrite)return;
  let percent=0;
  if(action==='delete'&&!confirm(t('حذف نهائي للمنتجات المحددة وعددها '+rows.length+'؟ لا يمكن التراجع عن الحذف.','Permanently delete '+rows.length+' selected products? This cannot be undone.','למחוק לצמיתות '+rows.length+' מוצרים? לא ניתן לבטל.')))return;
  if(action==='discount'){const raw=prompt(t('نسبة الخصم %','Discount percentage %','אחוז הנחה %'));if(raw===null)return;percent=Number(raw);if(!raw.trim()||!Number.isFinite(percent)||percent<0||percent>100){toast(t('أدخلي نسبة بين 0 و100','Enter a percentage from 0 to 100','הזינו אחוז בין 0 ל־100'));return}}
  setBusy(true);const done:string[]=[];let firstError='';
  try{
   for(const p of rows){try{
    if(action==='delete')await remove(p);
    else if(action==='featured'||action==='unfeatured')await save({...p,featured:action==='featured'});
    else if(action==='best'||action==='unbest')await save({...p,best:action==='best'});
    else if(action==='new'||action==='unnew')await save({...p,isNew:action==='new'});
    else if(action==='discount')await save({...p,oldPrice:p.oldPrice||p.price,price:Math.round(p.price*(1-percent/100)*100)/100});
    else await save({...p,status:action as Product['status']});
    done.push(p.id);
   }catch(error){if(!firstError)firstError=error instanceof Error?error.message:String(error)}}
   setSelected(selected.filter(id=>!done.includes(id)));
   toast(t('تم تنفيذ الإجراء على '+done.length+' من '+rows.length+' منتج.','Completed for '+done.length+' of '+rows.length+' products.','בוצע עבור '+done.length+' מתוך '+rows.length+' מוצרים.')+(firstError?' '+t('تعذر تنفيذ الباقي: ','Remaining items failed: ','היתר נכשלו: ')+firstError:''));
   if(done.length===rows.length)setAction('');
  }finally{setBusy(false)}
 }
 return <div className="product-bulk-actions" aria-label={t('إجراءات المنتجات المحددة','Selected product actions','פעולות למוצרים שנבחרו')}>
 <label className="check-label"><input type="checkbox" checked={all} disabled={busy||!visible.length} onChange={e=>setSelected(e.target.checked?Array.from(new Set([...selected,...visible.map(p=>p.id)])):selected.filter(id=>!visible.some(p=>p.id===id)))}/>{t('تحديد كل النتائج المعروضة','Select all displayed results','בחירת כל התוצאות המוצגות')}</label>
 <strong aria-live="polite">{rows.length} {t('محدد','selected','נבחרו')}</strong>
 {rows.length>0&&<button type="button" className="btn outline" disabled={busy} onClick={()=>setSelected([])}>{t('إلغاء التحديد','Clear selection','ביטול בחירה')}</button>}
 {canWrite&&<><label>{t('الإجراء','Action','פעולה')}<select value={action} disabled={busy||!rows.length} onChange={e=>setAction(e.target.value)}><option value="">{t('اختاري إجراء','Choose an action','בחרו פעולה')}</option>{[
 ['hidden',t('إخفاء','Hide','הסתרה')],['published',t('نشر / إظهار','Publish / show','פרסום')],['draft',t('نقل إلى المسودات','Move to drafts','העברה לטיוטות')],['archived',t('أرشفة','Archive','ארכיון')],['featured',t('إضافة للمميزة','Mark featured','סימון כמומלץ')],['unfeatured',t('إزالة من المميزة','Remove featured','הסרת המלצה')],['best',t('إضافة للأكثر مبيعًا','Add to bestsellers','הוספה לרבי מכר')],['unbest',t('إزالة من الأكثر مبيعًا','Remove from bestsellers','הסרה מרבי מכר')],['new',t('إضافة لوصلنا حديثًا','Add to new arrivals','הוספה לחדשים')],['unnew',t('إزالة من وصلنا حديثًا','Remove from new arrivals','הסרה מחדשים')],['discount',t('خصم جماعي','Bulk discount','הנחה מרובה')],['delete',t('حذف نهائي','Permanently delete','מחיקה לצמיתות')]
 ].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><button type="button" className="btn primary" disabled={busy||!rows.length||!action} onClick={()=>void apply()}>{busy?t('جارٍ التنفيذ…','Applying…','מבצע…'):t('تطبيق على المحدد','Apply to selected','החלה על הנבחרים')}</button></>}
 </div>;
}
