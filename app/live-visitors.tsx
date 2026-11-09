'use client';
import {useEffect,useState} from 'react';
import type {Lang,Product} from '../lib/catalog';
import type {LiveSnapshot} from '../lib/live-visitors';
import {db} from '../lib/supabase';
import './live-visitors.css';
export default function LiveVisitors({lang,products}:{lang:Lang;products:Product[]}){
 const [snapshot,setSnapshot]=useState<LiveSnapshot|null>(null),[error,setError]=useState(false),[refresh,setRefresh]=useState(0);
 const t=(ar:string,en:string,he:string)=>lang==='ar'?ar:lang==='he'?he:en;
 useEffect(()=>{if(!db)return;const client=db;let stopped=false,pending=false;let controller:AbortController|undefined;
  async function load(){if(stopped||pending||document.visibilityState!=='visible')return;pending=true;controller=new AbortController();const timeout=setTimeout(()=>controller?.abort(),8000);
   try{const {data,error}=await client.rpc('live_visitor_snapshot').abortSignal(controller.signal);if(stopped)return;if(error||!data||!Array.isArray(data.visitors))throw Error('Unavailable');setSnapshot(data as LiveSnapshot);setError(false);}catch{if(!stopped)setError(true)}finally{clearTimeout(timeout);pending=false}
  }
  void load();const timer=setInterval(()=>void load(),15000);const visible=()=>void load();document.addEventListener('visibilitychange',visible);
  return()=>{stopped=true;clearInterval(timer);controller?.abort();document.removeEventListener('visibilitychange',visible)};
 },[refresh]);
 const catalog=new Map(products.map(p=>[p.id,p]));
 function pageName(path:string){if(path==='/')return t('الرئيسية','Home','בית');if(path==='/shop')return t('المتجر','Shop','חנות');const p=catalog.get(path.slice('/product/'.length));return p?.name[lang]||p?.name.ar||t('صفحة منتج','Product page','עמוד מוצר');}
 return <section className="panel live-visitors"><div className="section-heading"><h3>{t('المتصلون الآن وسلاتهم','Online visitors & carts','מבקרים מחוברים וסלים')}</h3><button type="button" className="btn outline" onClick={()=>setRefresh(n=>n+1)}>{t('تحديث','Refresh','רענון')}</button></div>
 <div className="stats"><div><small>{t('زوار نشطون خلال آخر دقيقتين','Active in the last two minutes','פעילים בשתי הדקות האחרונות')}</small><strong>{error?'—':snapshot?snapshot.count.toLocaleString(lang):'…'}</strong></div><div><small>{t('سلات غير فارغة ضمن القائمة','Non-empty carts in this list','סלים מלאים ברשימה')}</small><strong>{error?'—':snapshot?snapshot.visitors.filter(v=>v.cart.length>0).length.toLocaleString(lang):'…'}</strong></div></div>
 <p>{t('الأرقام تقديرية لمتصفحات مفتوحة ومرئية، وليست أسماء أشخاص. يتحدث اتصال الزائر كل 30 ثانية وهذه اللوحة كل 15 ثانية. محتويات السلة لا تعني إتمام شراء.','Estimates of open, visible browsers, not identified people. Visitors update every 30 seconds; this panel every 15 seconds. Cart contents are not completed purchases.','אומדן לדפדפנים פתוחים וגלויים, ללא זיהוי אנשים. עדכון מבקרים כל 30 שניות והלוח כל 15 שניות. תוכן הסל אינו רכישה שהושלמה.')}</p>
 {error&&<p role="alert">{t('تعذر تحديث المتصلين؛ البيانات السابقة قديمة. التصفح والطلبات غير متأثرين.','Live update unavailable; previous data is stale. Browsing and orders are unaffected.','העדכון אינו זמין; הנתונים הקודמים אינם עדכניים. הגלישה וההזמנות אינן מושפעות.')}</p>}
 {snapshot&&<><small>{t('آخر تحديث','Last updated','עדכון אחרון')}: {new Date(snapshot.updated_at).toLocaleTimeString(lang)}</small>{snapshot.count>100&&<p>{t('تظهر أحدث 100 زيارة نشطة.','Showing the latest 100 active visitors.','מוצגים 100 המבקרים הפעילים האחרונים.')}</p>}
 {!snapshot.visitors.length&&!error&&<p>{t('لا يوجد زوار نشطون حاليًا.','No active visitors right now.','אין מבקרים פעילים כרגע.')}</p>}
 <div className="live-visitor-list">{snapshot.visitors.map(v=><details key={v.id}><summary><strong>{t('زائر','Visitor','מבקר')} {v.id.slice(0,8)}</strong><span>{pageName(v.page)}</span><b>{v.cart.reduce((sum,item)=>sum+item.qty,0)} {t('قطعة في السلة','items in cart','פריטים בסל')}</b></summary><p>{t('آخر اتصال','Last seen','נראה לאחרונה')}: {new Date(v.last_seen).toLocaleTimeString(lang)}</p>{v.cart.length?<ul>{v.cart.map((item,i)=>{const p=catalog.get(item.id);return <li key={item.id+':'+i}>{p?.images[0]&&<img src={p.images[0]} alt="" loading="lazy" width={48} height={60}/>}<span>{p?.name[lang]||p?.name.ar||t('منتج غير متاح','Unavailable product','מוצר לא זמין')}<small>{[item.color,item.size==='Standard'?'':item.size].filter(Boolean).join(' · ')}</small></span><b>× {item.qty}</b></li>})}</ul>:<p>{t('السلة فارغة','Cart is empty','הסל ריק')}</p>}</details>)}</div></>}
 </section>;
}
