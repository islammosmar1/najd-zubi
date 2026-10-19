'use client';
import { type CSSProperties } from 'react';
import type { Lang,Settings } from '../lib/catalog';
export default function AnnouncementBar({settings,lang}:{settings:Settings;lang:Lang}){
 const value=settings.announcement;
 const text=(value?.text?.[lang]||value?.text?.ar||'').trim().slice(0,240);
 if(value?.enabled===false||!text)return null;
 const duration=Math.min(60,Math.max(15,Number(value?.duration)||30));
 return <aside className="najd-ticker" dir={lang==='en'?'ltr':'rtl'} aria-label={lang==='ar'?'إعلانات المتجر':lang==='he'?'הודעות החנות':'Store announcements'} style={{'--ticker-duration':`${duration}s`} as CSSProperties}>
 <div className="najd-ticker-window"><div className="najd-ticker-track">{[0,1].map(i=><div className="najd-ticker-copy" key={i} aria-hidden={i===1?true:undefined}><span aria-hidden="true">✦</span><span>{text}</span><span aria-hidden="true">✦</span></div>)}</div></div>
 </aside>
}
