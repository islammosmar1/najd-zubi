'use client';
import {useEffect,useRef,useState} from 'react';
import type {Lang} from '../lib/catalog';
type Turnstile={render:(node:HTMLElement,options:{sitekey:string;callback:(token:string)=>void;'expired-callback':()=>void;'error-callback':()=>void})=>string;remove:(id:string)=>void};
declare global{interface Window{turnstile?:Turnstile}}
let loading:Promise<Turnstile>|undefined;
function loadWidget(){
 if(window.turnstile)return Promise.resolve(window.turnstile);
 if(loading)return loading;
 loading=new Promise<Turnstile>((resolve,reject)=>{const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;const timer=setTimeout(()=>{script.remove();reject(Error('Verification timed out'))},15000);script.onload=()=>{clearTimeout(timer);if(window.turnstile)resolve(window.turnstile);else reject(Error('Verification unavailable'))};script.onerror=()=>{clearTimeout(timer);script.remove();reject(Error('Verification unavailable'))};document.head.appendChild(script)}).catch(error=>{loading=undefined;throw error});
 return loading;
}
export default function CheckoutVerification({siteKey,onToken,lang}:{siteKey:string;onToken:(token:string)=>void;lang:Lang}){
 const host=useRef<HTMLDivElement>(null);const [failed,setFailed]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{let disposed=false;let widget:string|undefined;let api:Turnstile|undefined;void loadWidget().then(service=>{if(disposed||!host.current)return;api=service;widget=service.render(host.current,{sitekey:siteKey,callback:token=>{if(!disposed){setFailed(false);onToken(token)}},'expired-callback':()=>onToken(''),'error-callback':()=>{onToken('');setFailed(true)}})}).catch(()=>{if(!disposed){onToken('');setFailed(true)}});return()=>{disposed=true;if(widget)api?.remove(widget)}},[siteKey,onToken,retry]);
 return <div><div ref={host}/>{failed&&<p role="alert">{lang==='ar'?'تعذر التحقق من الاتصال. أعيدي المحاولة.':lang==='he'?'האימות נכשל. נסי שוב.':'Verification unavailable. Please retry.'} <button type="button" onClick={()=>{setFailed(false);setRetry(n=>n+1)}}>↻</button></p>}</div>;
}
