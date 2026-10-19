'use client';
import { useSyncExternalStore } from 'react';
function subscribe(notify:()=>void){window.addEventListener('storage',notify);window.addEventListener('popstate',notify);return()=>{window.removeEventListener('storage',notify);window.removeEventListener('popstate',notify)}}
function snapshot(){try{return JSON.stringify({common:localStorage.getItem('najd-state-v1'),landing:localStorage.getItem('najd-landing-preferences'),recent:localStorage.getItem('najd-recent-v1'),search:window.location.search})}catch{return JSON.stringify({search:window.location.search})}}
export function useBrowserSnapshot(){return useSyncExternalStore(subscribe,snapshot,()=>null)}

// Persistence failures are an external store shared by all local-storage writers.
const errorListeners=new Set<()=>void>();let persistenceError='';
export function reportPersistenceError(message:string){if(message===persistenceError)return;persistenceError=message;errorListeners.forEach(notify=>notify())}
function subscribeErrors(notify:()=>void){errorListeners.add(notify);return()=>{errorListeners.delete(notify)}}
export function usePersistenceError(){return useSyncExternalStore(subscribeErrors,()=>persistenceError,()=>'')}
