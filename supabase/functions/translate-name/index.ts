import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.117.2';
const origin=Deno.env.get('ALLOWED_ORIGIN')||'https://najd-cosmetics.glassyplume.chatgpt.site';
Deno.serve(async req=>{
 const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
 const out=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(req.method==='OPTIONS')return new Response(null,{headers});
 if(req.method!=='POST'||req.headers.get('origin')!==origin)return out({error:'Forbidden'},403);
 try{
  const token=req.headers.get('Authorization')?.replace(/^Bearer /,'')||'';
  const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:'Bearer '+token}},auth:{persistSession:false}});
  const {data:user,error:authError}=await client.auth.getUser();if(authError||!user.user)return out({error:'Unauthorized'},401);
  const perms=await Promise.all(['products.write','settings.write'].map(action=>client.rpc('can',{action})));if(!perms.some(p=>!p.error&&p.data===true))return out({error:'Forbidden'},403);
  const raw=await req.text();if(raw.length>3000)return out({error:'Input too large'},413);
  let body;try{body=JSON.parse(raw)}catch{return out({error:'Invalid JSON'},400)}
  if(typeof body.text!=='string'||!body.text.trim()||body.text.length>500)return out({error:'Invalid name'},400);
  const key=Deno.env.get('GOOGLE_TRANSLATE_API_KEY');if(!key)return out({error:'GOOGLE_NOT_CONFIGURED'},503);
  const service=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
  const rate=await service.rpc('consume_limit',{bucket:'translate:'+user.user.id,limit_count:60,seconds:60});if(rate.error)return out({error:'Please wait a minute before translating again'},429);
  const values=await Promise.all(['en','he'].map(async target=>{
   const response=await fetch('https://translation.googleapis.com/language/translate/v2',{method:'POST',headers:{'Content-Type':'application/json','X-goog-api-key':key},body:JSON.stringify({q:body.text.trim(),source:'ar',target,format:'text'}),signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw Error('Google translation unavailable; check billing and quotas');
   const data=await response.json();const value=data.data?.translations?.[0]?.translatedText;if(typeof value!=='string'||!value.trim()||value.length>2000)throw Error('Invalid translation');return value.trim();
  }));return out({ar:body.text.trim(),en:values[0],he:values[1],provider:'Google Cloud Translation'});
 }catch{return out({error:'Translation unavailable; edit manually or use Google Translate links'},502)}
});
