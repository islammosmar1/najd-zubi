import fs from 'node:fs';import assert from 'node:assert/strict';import ts from 'typescript';import vm from 'node:vm';import {webcrypto} from 'node:crypto';
let handler,lastArgs,rpcError=null,captchaSecret=false,captchaAnswer={success:true,hostname:'najd-cosmetics.glassyplume.chatgpt.site'};const source=fs.readFileSync('supabase/functions/checkout/index.ts','utf8').replace(/^import[^\n]+\n/,'');
const client={auth:{getUser:async token=>({data:{user:token==='valid'?{id:'approved-user'}:null}})},rpc:async(name,args)=>{if(name==='place_order_once'){lastArgs=args;return {data:{id:'NJD-MOCK'},error:rpcError}}return {error:null}}};
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText,{createClient:()=>client,Request,Response,URL,URLSearchParams,AbortSignal,fetch:async()=>({json:async()=>captchaAnswer}),TextEncoder,crypto:webcrypto,Deno:{env:{get:key=>key==='TURNSTILE_SECRET_KEY'&&captchaSecret?'test-secret':undefined},serve:fn=>handler=fn}});
const request_id='66666666-6666-4666-8666-666666666666';const payload={request_id,customer:{name:'test'},lines:[],city_index:0};
async function call(body,token='',origin='https://najd-cosmetics.glassyplume.chatgpt.site'){const r=await handler(new Request('https://example.test',{method:'POST',headers:{origin,authorization:'Bearer '+token},body:JSON.stringify(body)}));return {status:r.status,body:await r.json(),cache:r.headers.get('Cache-Control')}}
assert.equal((await call({...payload,request_id:'bad'})).status,400);assert.equal((await call({...payload,wholesale:true})).status,401);assert.equal((await call(payload,'','https://wrong.test')).status,403);
const result=await call({...payload,buyer:'attacker-selected-user'});assert.equal(result.status,200);assert.equal(result.cache,'no-store');assert.equal(lastArgs.buyer,null);assert.equal(lastArgs.request_id,request_id);
await call({...payload,wholesale:true,buyer:'wrong'},'valid');assert.equal(lastArgs.buyer,'approved-user');
console.log('PASS checkout handler: valid request ID required, verified wholesale identity only, origin rejection, private response cache headers, idempotent RPC routing. Mocked services.');

for(const raw of ['{', 'null', '[]', '1']){
 const response=await handler(new Request('https://example.test',{method:'POST',headers:{origin:'https://najd-cosmetics.glassyplume.chatgpt.site'},body:raw}));assert.equal(response.status,400);
}
rpcError={message:'relation private_customer_secret does not exist'};
assert.equal((await call(payload)).body.error,'Order could not be processed');
rpcError={message:'Insufficient variant stock'};
assert.equal((await call(payload)).body.error,'Insufficient variant stock');
console.log('PASS malformed request bodies are 400; unexpected database errors are redacted while stock errors remain actionable.');

rpcError=null;captchaSecret=true;
assert.equal((await call(payload)).status,400);
captchaAnswer={success:false,hostname:'najd-cosmetics.glassyplume.chatgpt.site'};assert.equal((await call({...payload,captchaToken:'token'})).status,400);
captchaAnswer={success:true,hostname:'wrong.test'};assert.equal((await call({...payload,captchaToken:'token'})).status,400);
captchaAnswer={success:true,hostname:'najd-cosmetics.glassyplume.chatgpt.site'};assert.equal((await call({...payload,captchaToken:'token'})).status,200);
console.log('PASS CAPTCHA server gate with mocked Cloudflare: missing, rejected and wrong-host tokens denied; valid host accepted.');
