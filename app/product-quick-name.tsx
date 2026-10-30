'use client';
import {useState} from 'react';
import {Pencil,Check,X} from 'lucide-react';
import type {Lang,Product} from '../lib/catalog';
type Props={product:Product;lang:Lang;canWrite:boolean;busy:boolean;setBusy:(value:boolean)=>void;save:(p:Product)=>Promise<void>;toast:(message:string)=>void};
export default function ProductQuickName({product,lang,canWrite,busy,setBusy,save,toast}:Props){
 const [editing,setEditing]=useState(false),[value,setValue]=useState('');
 const t=(ar:string,en:string,he:string)=>lang==='ar'?ar:lang==='he'?he:en;
 async function submit(){if(busy)return;const name=value.trim();if(!name){toast(t('اكتبي اسم المنتج','Enter a product name','הזינו שם מוצר'));return}
 if(name===product.name[lang]){setEditing(false);return}setBusy(true);
 try{await save({...product,name:{...product.name,[lang]:name}});setEditing(false);toast(t('تم حفظ الاسم','Name saved','השם נשמר'))}catch(e){toast(e instanceof Error?e.message:String(e))}finally{setBusy(false)}
 }
 return <div className="product-quick-name">{editing?<div className="quick-name-editor">
 <input autoFocus aria-label={t('اسم المنتج السريع','Quick product name','שם מוצר מהיר')} maxLength={160} value={value} disabled={busy} onChange={e=>setValue(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void submit()}if(e.key==='Escape'&&!busy){e.preventDefault();setEditing(false)}}}/>
 <div className="row"><button type="button" className="btn primary" disabled={busy||!value.trim()} onClick={()=>void submit()}><Check size={14}/>{t('حفظ الاسم','Save name','שמירת שם')}</button><button type="button" className="btn outline" disabled={busy} onClick={()=>setEditing(false)}><X size={14}/>{t('إلغاء','Cancel','ביטול')}</button></div>
 </div>:<><strong>{product.name[lang]||product.name.ar}</strong>{canWrite&&<button type="button" className="text-link quick-name-trigger" disabled={busy} onClick={()=>{setValue(product.name[lang]||product.name.ar);setEditing(true)}}><Pencil size={14}/>{t('تعديل الاسم','Rename','שינוי שם')}</button>}</>}</div>;
}
