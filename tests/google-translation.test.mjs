import fs from 'node:fs';import ts from 'typescript';import vm from 'node:vm';import assert from 'node:assert/strict';
let handler,key='',allowed=true,permission=true,rateBlocked=false,fetches=0,badGoogle=false;
function createClient(){return {auth:{getUser:async()=>({data:{user:allowed?{id:'staff'}:null}})},rpc:async(name)=>name==='can'?{data:permission}:{error:rateBlocked?{}:null}}}
const source=fs.readFileSync('supabase/functions/translate-name/index.ts','utf8').replace(/^import[^\n]+\n/,'');
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText,{createClient,Request,Response,AbortSignal,Deno:{serve:fn=>handler=fn,env:{get:n=>n==='GOOGLE_TRANSLATE_API_KEY'?key:'test'}},fetch:async(url,options)=>{fetches++;assert.equal(url,'https://translation.googleapis.com/language/translate/v2');assert.equal(options.headers['X-goog-api-key'],key);const b=JSON.parse(options.body);assert.equal(b.source,'ar');assert.equal(b.format,'text');return {ok:!badGoogle,json:async()=>({data:{translations:[{translatedText:b.target==='en'?'Bag':'תיק'}]}})}}});
async function call(body,origin='test'){const r=await handler(new Request('https://example.test',{method:'POST',headers:{Origin:origin},body:JSON.stringify(body)}));assert.equal(r.headers.get('cache-control'),'no-store');return {status:r.status,data:await r.json()}}
assert.equal((await call({text:'شنطة'},'wrong')).status,403);
allowed=false;assert.equal((await call({text:'شنطة'})).status,401);allowed=true;permission=false;assert.equal((await call({text:'شنطة'})).status,403);permission=true;
assert.equal((await call({text:'شنطة'})).status,503);assert.equal(fetches,0);
key='test-only';assert.equal((await call({text:'x'.repeat(501)})).status,400);
const success=await call({text:'شنطة',extra:'not forwarded'});assert.equal(success.status,200);assert.equal(success.data.en,'Bag');assert.equal(success.data.he,'תיק');
rateBlocked=true;assert.equal((await call({text:'شنطة'})).status,429);rateBlocked=false;badGoogle=true;assert.equal((await call({text:'شنطة'})).status,502);
console.log('PASS Google handler: auth, origin, key required, validation, rate limiting, language pairs, provider failure and no-store. Mock Google service; not a billed live translation.');
