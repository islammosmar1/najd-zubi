import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import assert from 'node:assert/strict';
const storage=new Map([['najd-state-v1',JSON.stringify({cart:[{id:'first',key:'first||Standard',qty:1}]})]]);
const listeners=new Map();let failure='';
const exports={};
const source=ts.transpileModule(fs.readFileSync('lib/cart-store.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext(source,{exports,require:name=>name==='react'?{useMemo:fn=>fn(),useCallback:fn=>fn,useSyncExternalStore:(subscribe,get)=>{subscribe(()=>{});return get();}}:{reportPersistenceError:message=>failure=message},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},Event,window:{addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:()=>{},dispatchEvent:e=>listeners.get(e.type)?.()}});
const firstPage=exports.useCart(); assert.equal(firstPage[0][0].id,'first');
firstPage[1](old=>[...old,{id:'second',key:'second||Standard',qty:1}]);
const secondPage=exports.useCart();assert.equal(secondPage[0].length,2);
// A restored older page must update the current shared cart rather than its old snapshot.
firstPage[1](old=>old.map(p=>p.id==='first'?{...p,qty:p.qty+1}:p));
assert.equal(exports.readCart().length,2);assert.equal(exports.readCart()[0].qty,2);
storage.set('najd-state-v1',JSON.stringify({cart:[],lang:'ar'}));assert.equal(exports.readCart().length,2);
assert.equal(listeners.has('pageshow'),true);assert.equal(listeners.has('storage'),true);
secondPage[1]([]);assert.equal(exports.readCart().length,0);assert.equal(failure,'');
console.log('PASS legacy cart migration, two products across pages, restored-page updates, independent preference writes and explicit removal');
