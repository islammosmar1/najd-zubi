'use client';
import { useCallback, useSyncExternalStore } from 'react';
const key='najd-wishlist-v1';
const event='najd-wishlist-change';
function ids(value:unknown):string[]{return Array.isArray(value)?[...new Set(value.filter((x):x is string=>typeof x==='string'))]:[]}
export function readWishlist():string[]{
 try {
  const saved=localStorage.getItem(key);
  if(saved!==null)return ids(JSON.parse(saved));
  const common=JSON.parse(localStorage.getItem('najd-state-v1')||'{}');
  const landing=JSON.parse(localStorage.getItem('najd-landing-preferences')||'{}');
  return ids(common.wishes??landing.favorite);
 }catch{return []}
}
function subscribe(notify:()=>void){window.addEventListener('storage',notify);window.addEventListener(event,notify);window.addEventListener('pageshow',notify);return()=>{window.removeEventListener('storage',notify);window.removeEventListener(event,notify);window.removeEventListener('pageshow',notify)}}
export function useWishlist(){
 const snapshot=useSyncExternalStore(subscribe,()=>JSON.stringify(readWishlist()),()=>'[]');
 const set=useCallback((value:string[]|((previous:string[])=>string[]))=>{
  const next=ids(typeof value==='function'?value(readWishlist()):value);
  try{localStorage.setItem(key,JSON.stringify(next));window.dispatchEvent(new Event(event))}catch{window.alert('تعذر حفظ المفضلة. تحققي من السماح بالتخزين في المتصفح.')}
 },[]);
 return [JSON.parse(snapshot) as string[],set] as const;
}
