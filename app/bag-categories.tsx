'use client';
import {useState} from 'react';
import type {Lang,Product,Settings} from '../lib/catalog';
import CategoryIcon from './category-icon';
export default function BagCategories({settings,products,lang}:{settings:Settings;products:Product[];lang:Lang}){
 const [expanded,setExpanded]=useState(false);
 const cats=settings.categories.filter(c=>c[0]!=='all'&&!settings.categoryMeta?.[c[0]]?.hidden&&!settings.categoryMeta?.[c[4]]?.hidden).sort((a,b)=>Number(b[4]==='bags')-Number(a[4]==='bags'));
 const label=(ar:string,en:string,he:string)=>lang==='ar'?ar:lang==='he'?he:en;
 return <nav className="category-carousel" aria-label={label('جميع أقسام المتجر','Shop categories','קטגוריות החנות')}>
 <div className="bag-category-strip" id="home-category-grid">{(expanded?cats:cats.slice(0,12)).map(c=>{const image=settings.categoryMeta?.[c[0]]?.image||products.find(p=>(p.category===c[0]||settings.categories.some(x=>x[0]===p.category&&x[4]===c[0]))&&p.images[0])?.images[0];return <a key={c[0]} href={'/shop?category='+encodeURIComponent(c[0])}><span>{image?<img src={image} alt="" width={140} height={140}/>:<CategoryIcon kind={c[4]||c[0]}/>}</span><strong>{c[lang==='ar'?1:lang==='en'?2:3]||c[1]}</strong></a>})}</div>
 {cats.length>12&&<button className="category-more" type="button" aria-controls="home-category-grid" aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}>{expanded?label('عرض أقل','Show less','הצגת פחות'):label('عرض المزيد','Show more','הצגת עוד')}</button>}
 </nav>;
}
