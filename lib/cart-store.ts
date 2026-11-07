'use client';
import {useCallback,useMemo,useSyncExternalStore} from 'react';
import type {CartItem} from './catalog';
import {reportPersistenceError} from './browser-snapshot';
const key='najd-cart-v1',event='najd-cart-change';
function valid(value:unknown):CartItem[]{return Array.isArray(value)?value.filter((x):x is CartItem=>!!x&&typeof x.id==='string'&&typeof x.key==='string'&&Number.isInteger(x.qty)&&x.qty>0):[];}
export function readCart():CartItem[]{try{const saved=localStorage.getItem(key);return valid(saved!==null?JSON.parse(saved):JSON.parse(localStorage.getItem('najd-state-v1')||'{}').cart);}catch{return [];}}
function subscribe(notify:()=>void){for(const name of ['storage','pageshow','popstate',event])window.addEventListener(name,notify);return()=>{for(const name of ['storage','pageshow','popstate',event])window.removeEventListener(name,notify)};}
export function useCart(){
 const snapshot=useSyncExternalStore(subscribe,()=>JSON.stringify(readCart()),()=>'[]');
 const cart=useMemo(()=>JSON.parse(snapshot) as CartItem[],[snapshot]);
 const setCart=useCallback((value:CartItem[]|((previous:CartItem[])=>CartItem[]))=>{const next=valid(typeof value==='function'?value(readCart()):value);try{localStorage.setItem(key,JSON.stringify(next));window.dispatchEvent(new Event(event));}catch{reportPersistenceError('تعذر حفظ السلة على الجهاز / Could not save the cart on this device');}},[]);
 return [cart,setCart] as const;
}
