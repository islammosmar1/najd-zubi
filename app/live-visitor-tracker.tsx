'use client';
import {useEffect} from 'react';
import {usePathname} from 'next/navigation';
import {db} from '../lib/supabase';
import {readCart} from '../lib/cart-store';
import {liveCart,liveVisitorPage,liveVisitorToken} from '../lib/live-visitors';
export default function LiveVisitorTracker(){
 const path=usePathname();
 useEffect(()=>{
  if(!db)return;const client=db;let stopped=false,pending=false,lastSent=0,retryAfter=0,failures=0;
  let scheduled:ReturnType<typeof setTimeout>|undefined;let controller:AbortController|undefined;
  async function send(){
   if(stopped||pending||document.visibilityState!=='visible'||navigator.webdriver||Date.now()<retryAfter)return;
   const page=liveVisitorPage(path,location.search);if(!page)return;
   if(Date.now()-lastSent<6000){schedule();return;}
   pending=true;controller=new AbortController();const timeout=setTimeout(()=>controller?.abort(),8000);
   try{const token=liveVisitorToken(localStorage);const {error}=await client.rpc('record_live_visitor',{visitor_token:token,page_path:page,cart_items:liveCart(readCart())}).abortSignal(controller.signal);if(error)throw error;lastSent=Date.now();failures=0;retryAfter=0;}
   catch{failures++;retryAfter=Date.now()+Math.min(300000,30000*2**Math.min(failures-1,4));}
   finally{clearTimeout(timeout);pending=false;}
  }
  function schedule(){clearTimeout(scheduled);scheduled=setTimeout(()=>void send(),Math.max(1000,6000-(Date.now()-lastSent)));}
  const visible=()=>{if(document.visibilityState==='visible')schedule()};
  const storage=(e:StorageEvent)=>{if(e.key==='najd-cart-v1'||e.key==='najd-state-v1')schedule()};
  void send();const interval=setInterval(()=>void send(),30000);
  window.addEventListener('najd-cart-change',schedule);window.addEventListener('storage',storage);window.addEventListener('pageshow',visible);document.addEventListener('visibilitychange',visible);
  return()=>{stopped=true;clearInterval(interval);clearTimeout(scheduled);controller?.abort();window.removeEventListener('najd-cart-change',schedule);window.removeEventListener('storage',storage);window.removeEventListener('pageshow',visible);document.removeEventListener('visibilitychange',visible)};
 },[path]);
 return null;
}
