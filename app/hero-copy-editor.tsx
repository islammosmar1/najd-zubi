'use client';
import './hero-copy-editor.css';
import {useState} from 'react';
import type {Lang} from '../lib/catalog';
import type {HeroMedia} from '../lib/hero-media';
import {heroCopy,heroCopyLimits,type HeroCopy} from '../lib/hero-copy';

export default function HeroCopyEditor({media,index,lang,onChange}:{media:HeroMedia;index:number;lang:Lang;onChange:(copy:HeroMedia['copy'])=>void}){
 const [editLang,setEditLang]=useState<Lang>(lang);
 const t=(ar:string,en:string,he:string)=>lang==='ar'?ar:lang==='he'?he:en;
 const value=heroCopy(media,index,editLang);
 const fields:[keyof HeroCopy,string][]=[
 ['eyebrow',t('النص الصغير أعلى العنوان','Small heading','כותרת קטנה')],
 ['title',t('العنوان الرئيسي','Main title','כותרת ראשית')],
 ['accent',t('تكملة العنوان باللون المميز','Highlighted title ending','סיום כותרת מודגש')],
 ['description',t('الوصف','Description','תיאור')],
 ['button',t('نص زر التسوق','Shop button text','טקסט כפתור קנייה')],
 ['quizLabel',t('نص رابط دليل الجمال','Beauty finder link text','טקסט קישור מדריך היופי')]
 ];
 return <fieldset className="hero-copy-editor"><legend>{t('النص فوق الصورة','Text over the image','טקסט מעל התמונה')}</legend>
 <label>{t('لغة نص الإعلان','Banner text language','שפת טקסט הבאנר')}<select value={editLang} onChange={e=>setEditLang(e.target.value as Lang)}><option value="ar">العربية</option><option value="en">English</option><option value="he">עברית</option></select></label>
 <p>{t('عدلي نص كل لغة بشكل مستقل. اتركي الحقل فارغًا لإخفائه. على الموبايل يظهر العنوان وزر التسوق فقط.','Edit each language separately. Clear a field to hide it. Mobile shows the title and shop button only.','ערכו כל שפה בנפרד. שדה ריק יוסתר. בנייד מוצגים הכותרת וכפתור הקנייה בלבד.')}</p>
 {fields.map(([key,label])=><label key={key}>{label}<textarea rows={key==='description'?3:2} dir={editLang==='en'?'ltr':'rtl'} value={value[key]} maxLength={heroCopyLimits[key]} onChange={e=>onChange({...media.copy,[editLang]:{...media.copy?.[editLang],[key]:e.target.value}})}/></label>)}
 <button type="button" className="btn outline" onClick={()=>{const next={...media.copy};delete next[editLang];onChange(next)}}>{t('استعادة النص الافتراضي لهذه اللغة','Reset this language to default','איפוס שפה זו לברירת המחדל')}</button>
 </fieldset>;
}
