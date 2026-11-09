import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import assert from 'node:assert/strict';
const compile=file=>ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const helpers={};vm.runInNewContext(compile('lib/live-visitors.ts'),{exports:helpers,URLSearchParams,crypto:{randomUUID:()=> '11111111-1111-4111-8111-111111111111'}});
let now=100000,path='/shop',effect,fail=false,calls=[],next=0;const timers=new Map(),intervals=new Map(),events=new Map(),docEvents=new Map(),storage=new Map();
const document={visibilityState:'visible',addEventListener:(k,v)=>docEvents.set(k,v),removeEventListener:k=>docEvents.delete(k)};
const window={addEventListener:(k,v)=>events.set(k,v),removeEventListener:k=>events.delete(k)};
const localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
const exports={};
vm.runInNewContext(compile('app/live-visitor-tracker.tsx'),{exports,require:name=>name==='react'?{useEffect:fn=>effect=fn}:name==='next/navigation'?{usePathname:()=>path}:name.includes('/supabase')?{db:{rpc:(fn,args)=>{calls.push({fn,args});return {abortSignal:async()=>({error:fail?{message:'offline'}:null})}}}}:name.includes('/cart-store')?{readCart:()=>[{id:'bag',qty:2,color:'black',size:'Standard',phone:'must-not-send'}]}:helpers,
document,window,localStorage,location:{search:''},navigator:{webdriver:false},crypto:{randomUUID:()=> '11111111-1111-4111-8111-111111111111'},Date:class extends Date{static now(){return now}},AbortController,
setTimeout:(fn,ms)=>{const id=++next;timers.set(id,{fn,ms});return id},clearTimeout:id=>timers.delete(id),setInterval:(fn,ms)=>{const id=++next;intervals.set(id,{fn,ms});return id},clearInterval:id=>intervals.delete(id)});
const flush=()=>new Promise(resolve=>setImmediate(resolve));
exports.default();let stop=effect();await flush();assert.equal(calls.length,1);assert.equal(JSON.stringify(calls).includes('must-not-send'),false);
document.visibilityState='hidden';now+=30000;for(const {fn} of intervals.values())fn();await flush();assert.equal(calls.length,1);
document.visibilityState='visible';events.get('najd-cart-change')();const scheduled=[...timers.values()][0];now+=6000;scheduled.fn();await flush();assert.equal(calls.length,2);
fail=true;now+=30000;for(const {fn} of intervals.values())fn();await flush();assert.equal(calls.length,3);now+=1000;for(const {fn} of intervals.values())fn();await flush();assert.equal(calls.length,3);
stop();assert.equal(intervals.size,0);assert.equal(events.size,0);assert.equal(docEvents.size,0);
path='/admin';exports.default();stop=effect();await flush();assert.equal(calls.length,3);stop();
console.log('PASS tracker: sanitized background RPC, hidden-page pause, cart updates, error backoff, listener cleanup and admin-page exclusion. Mocked browser lifecycle, not a live browser test.');
