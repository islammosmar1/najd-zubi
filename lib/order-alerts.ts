'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {Dispatch,SetStateAction} from 'react';
import {db} from './supabase';
import type {Order} from './catalog';
export function useOrderAlerts(active:boolean,setOrders:Dispatch<SetStateAction<Order[]>>,notify:(message:string)=>void,message:string){
 const [unread,setUnread]=useState(0),[sound,setSound]=useState(false),[connected,setConnected]=useState(false);
 const audio=useRef<AudioContext|null>(null),enabled=useRef(false),notifier=useRef({notify,message});
 useEffect(()=>{notifier.current={notify,message}},[notify,message]);
 const chime=useCallback(()=>{const ctx=audio.current;if(!enabled.current||!ctx||ctx.state!=='running')return;[660,880,1100].forEach((hz,i)=>{const osc=ctx.createOscillator(),gain=ctx.createGain(),start=ctx.currentTime+i*.18;osc.frequency.value=hz;gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.12,start+.02);gain.gain.exponentialRampToValueAtTime(.001,start+.3);osc.connect(gain);gain.connect(ctx.destination);osc.start(start);osc.stop(start+.32)})},[]);
 const toggleSound=useCallback(async()=>{if(enabled.current){enabled.current=false;setSound(false);return}try{audio.current??=new AudioContext();await audio.current.resume();enabled.current=true;setSound(true);chime()}catch{notifier.current.notify('تعذر تشغيل الصوت. تحققي من إعدادات صوت المتصفح.')}},[chime]);
 useEffect(()=>()=>{void audio.current?.close()},[]);
 useEffect(()=>{
  if(!active||!db)return;const client=db;let stopped=false,fetching=false,initialized=false;const known=new Set<string>();let channel:ReturnType<typeof client.channel>|undefined;
  function receive(rows:Order[],initial=false){if(stopped)return;const fresh=rows.filter(o=>!known.has(o.id));rows.forEach(o=>known.add(o.id));setOrders(previous=>{const values=new Map(previous.map(o=>[o.id,o]));rows.forEach(o=>values.set(o.id,o));return [...values.values()].sort((a,b)=>b.created_at.localeCompare(a.created_at))});if(!initial&&fresh.length){setUnread(n=>n+fresh.length);notifier.current.notify(`${notifier.current.message} (${fresh.length})`);chime()}}
  async function refresh(){if(fetching||stopped)return;fetching=true;try{const {data,error}=await client.from('orders').select('*').order('created_at',{ascending:false}).limit(500);if(error)throw error;receive((data||[]) as Order[],!initialized);initialized=true;setConnected(true)}catch{if(!stopped)setConnected(false)}finally{fetching=false}}
  void refresh().then(()=>{if(stopped)return;channel=client.channel('admin-order-alerts').on('postgres_changes',{event:'*',schema:'public',table:'orders'},()=>{void refresh()}).subscribe()});
  // Polling also works when orders is not in the Realtime publication.
  const timer=setInterval(()=>{void refresh()},15000);const onFocus=()=>{void refresh()};window.addEventListener('focus',onFocus);
  return()=>{stopped=true;clearInterval(timer);window.removeEventListener('focus',onFocus);if(channel)void client.removeChannel(channel)};
 },[active,setOrders,chime]);
 return {unread,clear:()=>setUnread(0),sound,toggleSound,connected};
}
