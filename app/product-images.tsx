'use client';
import {useRef,useState} from 'react';
import {ChevronLeft,ChevronRight} from 'lucide-react';
import type {Lang} from '../lib/catalog';
import './product-images.css';

export default function ProductImages({images,name,lang,href,onOpen,index,onIndex,width=600,height=700}:{images:string[];name:string;lang:Lang;href?:string;onOpen?:()=>void;index?:number;onIndex?:(index:number)=>void;width?:number;height?:number}){
 const [local,setLocal]=useState(0);const start=useRef<{x:number;y:number}|null>(null),swiped=useRef(false);
 const current=((index??local)%Math.max(1,images.length)+images.length)%Math.max(1,images.length);
 const move=(delta:number)=>{const next=(current+delta+images.length)%images.length;if(onIndex)onIndex(next);else setLocal(next)};
 const t=(ar:string,en:string,he:string)=>lang==='ar'?ar:lang==='he'?he:en;
 const photo=<img src={images[current]} alt={name} loading="lazy" width={width} height={height} draggable={false}/>;
 return <div className="product-images" onTouchStart={e=>{swiped.current=false;const p=e.touches[0];start.current=e.touches.length===1?{x:p.clientX,y:p.clientY}:null}} onTouchMove={e=>{const p=e.touches[0],s=start.current;if(s&&Math.abs(p.clientX-s.x)>40&&Math.abs(p.clientX-s.x)>Math.abs(p.clientY-s.y)*1.3)swiped.current=true}} onTouchCancel={()=>{start.current=null}} onTouchEnd={e=>{const s=start.current;start.current=null;if(!s||images.length<2)return;const p=e.changedTouches[0],dx=p.clientX-s.x,dy=p.clientY-s.y;if(Math.abs(dx)>40&&Math.abs(dx)>Math.abs(dy)*1.3){swiped.current=true;move(dx<0?1:-1);}}} onClickCapture={e=>{if(swiped.current){e.preventDefault();e.stopPropagation();swiped.current=false}}}>
 {href?<a className="product-images-open" href={href}>{photo}</a>:onOpen?<button type="button" className="product-images-open" onClick={onOpen} aria-label={name}>{photo}</button>:photo}
 {images.length>1&&<><button type="button" className="product-images-prev" aria-label={t('الصورة السابقة','Previous image','תמונה קודמת')} onClick={e=>{e.preventDefault();e.stopPropagation();move(-1)}}><ChevronLeft size={18}/></button><button type="button" className="product-images-next" aria-label={t('الصورة التالية','Next image','תמונה הבאה')} onClick={e=>{e.preventDefault();e.stopPropagation();move(1)}}><ChevronRight size={18}/></button><span className="product-images-count" aria-live="polite">{current+1} / {images.length}</span></>}
 </div>;
}
