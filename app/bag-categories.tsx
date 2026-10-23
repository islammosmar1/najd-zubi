'use client';
import {useEffect,useRef,useState} from 'react';
import {ChevronLeft,ChevronRight} from 'lucide-react';
import type {Lang,Product,Settings} from '../lib/catalog';
import CategoryIcon from './category-icon';
export default function BagCategories({settings,products,lang}:{settings:Settings;products:Product[];lang:Lang}){
 const track=useRef<HTMLDivElement>(null);const [position,setPosition]=useState({overflow:false,start:true,end:false});const rtl=lang!=='en';
 const cats=settings.categories.filter(c=>c[0]!=='all'&&!settings.categoryMeta?.[c[0]]?.hidden&&!settings.categoryMeta?.[c[4]]?.hidden).sort((a,b)=>Number(b[4]==='bags')-Number(a[4]==='bags'));
 useEffect(()=>{const el=track.current;if(!el)return;const update=()=>{const max=el.scrollWidth-el.clientWidth,offset=Math.abs(el.scrollLeft);setPosition({overflow:max>2,start:offset<2,end:offset>=max-2})};update();const observer=new ResizeObserver(update);observer.observe(el);el.addEventListener('scroll',update,{passive:true});return()=>{observer.disconnect();el.removeEventListener('scroll',update)}},[cats.length,lang]);
 function move(forward:boolean){const el=track.current;if(el)el.scrollBy({left:(forward?1:-1)*(rtl?-1:1)*el.clientWidth*.8,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})}
 const label=(ar:string,en:string,he:string)=>lang==='ar'?ar:lang==='he'?he:en;
 return <nav className="category-carousel" aria-label={label('جميع أقسام المتجر','Shop categories','קטגוריות החנות')}>
 {position.overflow&&<button className="category-arrow category-prev" type="button" aria-label={label('الأقسام السابقة','Previous categories','קטגוריות קודמות')} disabled={position.start} onClick={()=>move(false)}>{rtl?<ChevronRight/>:<ChevronLeft/>}</button>}
 <div className="bag-category-strip" ref={track}>{cats.map(c=>{const image=settings.categoryMeta?.[c[0]]?.image||products.find(p=>(p.category===c[0]||settings.categories.some(x=>x[0]===p.category&&x[4]===c[0]))&&p.images[0])?.images[0];return <a key={c[0]} href={'/shop?category='+encodeURIComponent(c[0])}><span>{image?<img src={image} alt="" width={140} height={140}/>:<CategoryIcon kind={c[4]||c[0]}/>}</span><strong>{c[lang==='ar'?1:lang==='en'?2:3]||c[1]}</strong></a>})}</div>
 {position.overflow&&<button className="category-arrow category-next" type="button" aria-label={label('الأقسام التالية','Next categories','הקטגוריות הבאות')} disabled={position.end} onClick={()=>move(true)}>{rtl?<ChevronLeft/>:<ChevronRight/>}</button>}
 </nav>;
}
