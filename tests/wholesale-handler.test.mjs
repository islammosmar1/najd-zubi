// Runs the actual Edge handler with an in-memory Auth/DB adapter; no production accounts.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const accounts=[],users=new Map();let handler,deny=false,rateBlocked=false,failInsert=false,seq=0;
const service={
 rpc:async()=>({error:rateBlocked?{message:'limit'}:null}),
 auth:{getUser:async token=>({data:{user:token==='owner'?{id:'owner'}:token==='employee'?{id:'employee'}:null}}),admin:{
 createUser:async x=>{const user={id:'user-'+(++seq),...x};users.set(user.id,user);return {data:{user}}},
 deleteUser:async id=>{users.delete(id);return {error:null}},
 getUserById:async id=>({data:{user:users.get(id)}}),
 updateUserById:async(id,x)=>{Object.assign(users.get(id),x);return {error:null}}
 }},
 from:()=>{let filters=[],update;const q={select:()=>q,eq:(key,val)=>{filters.push([key,val]);return q},maybeSingle:async()=>({data:accounts.find(a=>filters.every(([k,v])=>a[k]===v))||null}),insert:async x=>{if(failInsert)return {error:{message:'failed'}};accounts.push(x);return {error:null}},update:x=>{update=x;return q},then:(resolve,reject)=>Promise.resolve().then(()=>{accounts.filter(a=>filters.every(([k,v])=>a[k]===v)).forEach(a=>Object.assign(a,update));return {error:null}}).then(resolve,reject)};return q}
};
function createClient(url,key,options){if(key==='service')return service;if(options?.global)return {rpc:async()=>({data:!deny&&options.global.headers.Authorization==='Bearer owner'})};return {auth:{signInWithPassword:async x=>{const u=[...users.values()].find(u=>u.email===x.email&&u.password===x.password);return u?{data:{session:{access_token:'access-'+u.id,refresh_token:'refresh-'+u.id}}}:{error:{message:'invalid'},data:{session:null}}}}}
}
const source=fs.readFileSync('supabase/functions/wholesale-accounts/index.ts','utf8').replace(/^import[^\n]+\n/,'');
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText,{createClient,Request,Response,TextEncoder,crypto:webcrypto,Deno:{env:{get:key=>({SUPABASE_URL:'https://example.test',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service'})[key]},serve:fn=>handler=fn}});
async function call(body,token='owner',origin='https://najd-cosmetics.glassyplume.chatgpt.site'){const response=await handler(new Request('https://example.test',{method:'POST',headers:{Origin:origin,Authorization:'Bearer '+token},body:JSON.stringify(body)}));return {status:response.status,body:await response.json(),cache:response.headers.get('cache-control')}}
const input={action:'create',name:'QA isolated shop',phone:'+970599000001',password:'Synthetic-Password-123'};
for(const origin of ['http://127.0.0.1:5173','http://localhost:5173']){
 const preflight=await handler(new Request('https://example.test',{method:'OPTIONS',headers:{Origin:origin}}));
 assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),origin);
 assert.equal((await call(input,'',origin)).status,401);
 assert.equal((await call(input,'employee',origin)).status,403);
 assert.equal((await call({...input,phone:'+970599000099'},'owner',origin)).status,origin.includes('127.0.0.1')?200:409);
}
accounts.length=0;users.clear();
for(const origin of ['https://wrong.test','http://127.0.0.1:5174','null']){
 const rejected=await handler(new Request('https://example.test',{method:'OPTIONS',headers:{Origin:origin}}));assert.equal(rejected.status,403);assert.equal(rejected.headers.get('access-control-allow-origin'),null);
}
assert.equal((await call(input,'')).status,401);assert.equal((await call(input,'employee')).status,403);assert.equal((await call(input,'owner','https://wrong.test')).status,403);
assert.equal((await call({...input,password:'short'})).status,400);
assert.equal((await call(input)).status,200);assert.equal(accounts.length,1);assert.equal(accounts[0].active,true);
assert.equal((await call(input)).status,409);assert.equal(users.size,1);
const id=accounts[0].id;let login=await call({action:'login',phone:input.phone,password:input.password},'');assert.equal(login.status,200);assert.equal(login.cache,'no-store');assert.equal(login.body.access_token,'access-'+id);assert.equal(Object.keys(login.body).length,2);
assert.equal((await call({action:'login',phone:input.phone,password:'wrong'},'')).status,401);
assert.equal((await call({action:'toggle',id,active:false})).status,200);assert.equal((await call({action:'login',phone:input.phone,password:input.password},'')).status,401);
await call({action:'toggle',id,active:true});await call({action:'password',id,password:'Changed-Password-456'});
assert.equal((await call({action:'login',phone:input.phone,password:input.password},'')).status,401);assert.equal((await call({action:'login',phone:input.phone,password:'Changed-Password-456'},'')).status,200);
failInsert=true;assert.equal((await call({...input,phone:'+970599000002'})).status,400);assert.equal(users.size,1,'Auth user cleaned up after membership insert failure');failInsert=false;
rateBlocked=true;assert.equal((await call({action:'login',phone:input.phone,password:'Changed-Password-456'},'')).status,429);rateBlocked=false;
deny=true;assert.equal((await call({action:'toggle',id,active:false})).status,403);assert.equal(accounts[0].active,true);
console.log('PASS actual wholesale handler with mocked services: create, duplicate, login, incorrect password, disable/reactivate, password reset, rollback, permissions, rate limit, origin, no-store. Not an authenticated live-browser test.');

deny=false;
const changedPhone='+970599000003';
assert.equal((await call({action:'update',id,name:'Updated shop',phone:changedPhone},'employee')).status,403);
assert.equal((await call({action:'update',id,name:'X',phone:changedPhone})).status,400);
assert.equal((await call({action:'update',id,name:'Updated shop',phone:'0599'})).status,400);
assert.equal((await call({action:'update',id,name:'Updated shop',phone:changedPhone})).status,200);
assert.equal(accounts[0].name,'Updated shop');
assert.equal((await call({action:'login',phone:input.phone,password:'Changed-Password-456'},'')).status,401);
assert.equal((await call({action:'login',phone:changedPhone,password:'Changed-Password-456'},'')).status,200);
await call({...input,phone:'+970599000004'});
assert.equal((await call({action:'update',id,name:'Collision',phone:'+970599000004'})).status,409);
assert.equal(accounts[0].phone,changedPhone);
console.log('PASS account edits: authorized name/phone update, invalid fields rejected, duplicate phone rejected, login migrates to new number without changing password.');
