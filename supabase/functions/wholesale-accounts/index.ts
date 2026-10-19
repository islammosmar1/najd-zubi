import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.117.2';
const allowed=Deno.env.get('ALLOWED_ORIGIN')||'https://najd-cosmetics.glassyplume.chatgpt.site';
const origins=new Set([allowed,'http://127.0.0.1:5173','http://localhost:5173']);
Deno.serve(async req=>{
 const origin=req.headers.get('origin')||'';const permitted=origins.has(origin);
 const headers:Record<string,string>={'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info,x-retry-count,traceparent,tracestate,baggage','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json','Vary':'Origin','Cache-Control':'no-store'};
 if(permitted)headers['Access-Control-Allow-Origin']=origin;
 const out=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers});if(!permitted)return out({error:'Forbidden'},403);if(req.method==='OPTIONS')return new Response(null,{status:204,headers});if(req.method!=='POST')return out({error:'Method not allowed'},405);
 try{
 const text=await req.text();if(text.length>6000)return out({error:'Request too large'},413);const b=JSON.parse(text);
 const url=Deno.env.get('SUPABASE_URL')!,key=Deno.env.get('SUPABASE_ANON_KEY')!,service=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
 const phone=String(b.phone||'').replace(/[\s()-]/g,'').replace(/^00/,'+');
 if(b.action==='login'){
 const ip=req.headers.get('x-forwarded-for')?.split(',')[0]||'unknown';const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ip+(Deno.env.get('RATE_LIMIT_SALT')||''))))).map(x=>x.toString(16).padStart(2,'0')).join('');
 for(const bucket of ['wh-ip:'+hash,'wh-phone:'+phone]){const r=await service.rpc('consume_limit',{bucket,limit_count:10,seconds:900});if(r.error)return out({error:'حاول لاحقًا / Try again later'},429)}
 const fail=()=>out({error:'رقم الهاتف أو كلمة المرور غير صحيحة، أو الحساب غير مفعّل / Invalid credentials or inactive account'},401);
 if(!/^\+[0-9]{8,15}$/.test(phone)||typeof b.password!=='string')return fail();
 const a=await service.from('wholesale_accounts').select('id').eq('phone',phone).eq('active',true).maybeSingle();if(!a.data)return fail();
 const user=await service.auth.admin.getUserById(a.data.id);if(!user.data.user?.email)return fail();
 const login=await createClient(url,key,{auth:{persistSession:false}}).auth.signInWithPassword({email:user.data.user.email,password:b.password});if(login.error||!login.data.session)return fail();
 return out({access_token:login.data.session.access_token,refresh_token:login.data.session.refresh_token});
 }
 const token=req.headers.get('Authorization')?.replace(/^Bearer /,'')||'';const actor=await service.auth.getUser(token);if(actor.error||!actor.data.user)return out({error:'Unauthorized'},401);
 const scoped=createClient(url,key,{global:{headers:{Authorization:'Bearer '+token}},auth:{persistSession:false}});const permission=await scoped.rpc('can',{action:'staff.manage'});if(permission.error||permission.data!==true)return out({error:'Forbidden'},403);
 const rate=await service.rpc('consume_limit',{bucket:'wh-admin:'+actor.data.user.id,limit_count:30,seconds:60});if(rate.error)return out({error:'Try again later'},429);
 if(b.action==='create'){
 if(!/^\+[0-9]{8,15}$/.test(phone)||typeof b.name!=='string'||b.name.trim().length<2||b.name.length>100||typeof b.password!=='string'||b.password.length<12)return out({error:'اسم صحيح، هاتف دولي، وكلمة مرور 12 حرفًا على الأقل مطلوبة'},400);
 const exists=await service.from('wholesale_accounts').select('id').eq('phone',phone).maybeSingle();if(exists.error)return out({error:'Could not check account'},400);if(exists.data)return out({error:'هذا الرقم مسجل / Phone already registered'},409);
 const created=await service.auth.admin.createUser({email:'wh-'+crypto.randomUUID()+'@accounts.najd.invalid',password:b.password,email_confirm:true});if(created.error||!created.data.user)return out({error:created.error?.message||'Creation failed'},400);
 const saved=await service.from('wholesale_accounts').insert({id:created.data.user.id,name:b.name.trim(),phone,active:true});if(saved.error){await service.auth.admin.deleteUser(created.data.user.id);return out({error:'Account could not be saved'},400)}
 return out({ok:true});
 }
 const existing=await service.from('wholesale_accounts').select('id').eq('id',b.id).maybeSingle();if(!existing.data)return out({error:'Account not found'},404);
 if(b.action==='update'){
 if(!/^\+[0-9]{8,15}$/.test(phone)||typeof b.name!=='string'||b.name.trim().length<2||b.name.length>100)return out({error:'أدخل اسمًا صحيحًا ورقم هاتف دوليًا / Valid name and international phone required'},400);
 const duplicate=await service.from('wholesale_accounts').select('id').eq('phone',phone).maybeSingle();if(duplicate.error)throw duplicate.error;if(duplicate.data&&duplicate.data.id!==b.id)return out({error:'هذا الرقم مسجل / Phone already registered'},409);
 const saved=await service.from('wholesale_accounts').update({name:b.name.trim(),phone}).eq('id',b.id);if(saved.error)return out({error:'تعذر حفظ الحساب؛ تأكد من الرقم / Account could not be saved'},400);
 return out({ok:true});
 }
 if(b.action==='toggle'&&typeof b.active==='boolean'){const r=await service.from('wholesale_accounts').update({active:b.active}).eq('id',b.id);if(r.error)throw r.error;return out({ok:true})}
 if(b.action==='password'&&typeof b.password==='string'&&b.password.length>=12){const r=await service.auth.admin.updateUserById(b.id,{password:b.password});if(r.error)return out({error:r.error.message},400);return out({ok:true})}
 return out({error:'Invalid action'},400);
 }catch{return out({error:'Could not process request'},400)}
});
