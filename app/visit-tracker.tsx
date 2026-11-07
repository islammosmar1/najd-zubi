'use client';
import {useEffect} from 'react';
import {usePathname} from 'next/navigation';
import {db} from '../lib/supabase';
import {visitSession} from '../lib/visit-session';
export default function VisitTracker(){
 const path=usePathname();
 useEffect(()=>{let active=true;let pending=false;const track=async()=>{if(!db||pending||document.visibilityState==='hidden'||path==='/admin'||new URLSearchParams(location.search).has('admin')||navigator.webdriver)return;pending=true;try{const visit=visitSession(localStorage);if(active)await db.rpc('record_site_visit',{visitor:visit.visitor,session:visit.session});}catch{/* Analytics never blocks shopping. */}finally{pending=false}};void track();const visible=()=>{if(document.visibilityState==='visible')void track()};document.addEventListener('visibilitychange',visible);window.addEventListener('pageshow',visible);return()=>{active=false;document.removeEventListener('visibilitychange',visible);window.removeEventListener('pageshow',visible)};},[path]);
 return null;
}
