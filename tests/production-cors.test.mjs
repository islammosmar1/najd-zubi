import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';import assert from 'node:assert/strict';
for(const name of ['translate-name','beauty-ai']){
 let handler;const source=fs.readFileSync('supabase/functions/'+name+'/index.ts','utf8').replace(/^import[^\n]+\n/,'');
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText,{Request,Response,Deno:{serve:fn=>handler=fn,env:{get:()=>undefined}},createClient:()=>({auth:{getUser:async()=>({data:{user:null}})}})});
 for(const origin of ['https://najd-zubi-islammosmar1s-projects.vercel.app','http://127.0.0.1:5173','http://localhost:5173']){
  const pre=await handler(new Request('https://service.test',{method:'OPTIONS',headers:{Origin:origin}}));assert.equal(pre.status,204);assert.equal(pre.headers.get('access-control-allow-origin'),origin);
  const response=await handler(new Request('https://service.test',{method:'POST',headers:{Origin:origin},body:JSON.stringify({mode:'product',text:'Bag'})}));assert.equal(response.status,401);
 }
 const rejected=await handler(new Request('https://service.test',{method:'OPTIONS',headers:{Origin:'https://untrusted.invalid'}}));assert.equal(rejected.status,403);
 console.log('PASS '+name+': exact production/local CORS, untrusted origins denied, authentication required.');
}
