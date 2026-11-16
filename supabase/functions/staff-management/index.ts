import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.117.2';
const permissions=['products.read','products.write','orders.read','orders.write','customers.read','customers.write','delivery.write','promotions.write','settings.write','reports.read','ai.manage','staff.manage','audit.read'];
const presets:Record<string,string[]>={orders:['orders.read','orders.write','products.read'],products:['products.read','products.write'],support:['orders.read','customers.read','customers.write']};
const origins=new Set(['https://www.najd.ps','https://najd.ps',Deno.env.get('ALLOWED_ORIGIN')||'','http://localhost:3000','http://127.0.0.1:3000']);
Deno.serve(async req=>{
 const origin=req.headers.get('origin')||'';
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Origin':origins.has(origin)?origin:'','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
 const out=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(origin&&!origins.has(origin))return out({error:'Origin not allowed'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return out({error:'Method not allowed'},405);
 try{
 const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!;
 const caller=createClient(url,anon,{global:{headers:{Authorization:req.headers.get('authorization')||''}},auth:{persistSession:false}});
 const {data:auth,error:authError}=await caller.auth.getUser();if(authError||!auth.user)return out({error:'Unauthorized'},401);
 const {data:allowed,error:accessError}=await caller.rpc('can',{action:'staff.manage'});if(accessError||!allowed)return out({error:'Forbidden'},403);
 const service=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
 const body=await req.json();
 if(body.action==='list'){
  const {data,error}=await caller.from('admins').select('id,display_name,role,permissions,require_mfa').order('display_name');if(error)throw error;
  const members=await Promise.all((data||[]).map(async member=>{const r=await service.auth.admin.getUserById(member.id);return {...member,email:r.data?.user?.email||''}}));
  return out({members,self:auth.user.id});
 }
 if(!['create','update','disable'].includes(body.action))return out({error:'Invalid action'},400);
 const name=String(body.display_name||'').trim(),role=String(body.role||'orders');
 if(body.action!=='disable'&&(!name||name.length>100||!presets[role]))return out({error:'Invalid name or role'},400);
 const selected=body.permissions??presets[role];
 if(body.action!=='disable'&&(!Array.isArray(selected)||selected.length>permissions.length||selected.some((p:unknown)=>typeof p!=='string'||!permissions.includes(p))))return out({error:'Invalid permissions'},400);
 const member={display_name:name,role,permissions:[...new Set(selected||[])],require_mfa:body.require_mfa===true};
 if(body.action==='create'){
  const email=String(body.email||'').trim().toLowerCase(),password=String(body.password||'');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||password.length<12||password.length>128)return out({error:'Enter a valid email and a password of 12–128 characters'},400);
  const created=await service.auth.admin.createUser({email,password,email_confirm:true});
  if(created.error||!created.data.user)return out({error:'Could not create account. The email may already be registered.'},400);
  const id=created.data.user.id;
  const saved=await caller.from('admins').insert({id,...member});
  if(saved.error){await service.auth.admin.deleteUser(id);return out({error:'Could not save staff access'},400)}
  return out({ok:true,id});
 }
 const id=String(body.id||'');if(!/^[0-9a-f-]{36}$/i.test(id))return out({error:'Invalid member'},400);
 if(id===auth.user.id)return out({error:'You cannot change your own access here'},400);
 const found=await caller.from('admins').select('role,permissions').eq('id',id).maybeSingle();
 if(found.error||!found.data)return out({error:'Staff member not found'},404);
 if(found.data.role==='owner'||found.data.permissions.includes('*'))return out({error:'Owner accounts are protected'},403);
 const result=await caller.from('admins').update(body.action==='disable'?{permissions:[]}:member).eq('id',id).select('id');
 if(result.error||!result.data?.length)return out({error:'Could not save staff access'},400);
 return out({ok:true});
 }catch{return out({error:'Could not complete staff request'},400)}
});
