import { db } from './supabase';
export type Names={ar:string;en:string;he:string};
const cache=new Map<string,Names>();
export function googleTranslateLink(text:string,target:'en'|'he'){return 'https://translate.google.com/?'+new URLSearchParams({sl:'ar',tl:target,text,op:'translate'}).toString()}
export async function translateName(ar:string,signal?:AbortSignal):Promise<Names>{
 const text=ar.trim();if(!text)return {ar:'',en:'',he:''};if(text.length>500)throw Error('الاسم طويل؛ الحد 500 حرف / Name too long');
 if(signal?.aborted)throw new DOMException('Aborted','AbortError');if(cache.has(text))return cache.get(text)!;
 if(!db)throw Error('يلزم تسجيل الدخول / Sign in required');
 const {data,error}=await db.functions.invoke('translate-name',{body:{text},signal});
 if(error){let code='';try{code=(await error.context?.json())?.error||''}catch{}throw Error(code==='GOOGLE_NOT_CONFIGURED'?'ترجمة Google التلقائية تحتاج تفعيل مفتاح الخدمة؛ استخدمي روابط Google أدناه أو اكتبي الترجمة يدويًا':'تعذرت ترجمة Google؛ حاولي مجددًا أو استخدمي الروابط أدناه / Google translation unavailable');}
 if(!data||typeof data.en!=='string'||typeof data.he!=='string'||!data.en.trim()||!data.he.trim()||data.en.length>2000||data.he.length>2000)throw Error('Invalid translation');
 const result={ar:text,en:data.en,he:data.he};if(cache.size>=300)cache.delete(cache.keys().next().value!);cache.set(text,result);return result;
}
