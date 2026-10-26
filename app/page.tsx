import HomeLanding from './home-landing';
import {pageMetadata,storeTitle,storeDescription} from '../lib/seo';
import {publicConfig} from '../lib/public-config';
import type {Settings} from '../lib/catalog';
export const metadata=pageMetadata(storeTitle,storeDescription,'/');
export const revalidate=30;
export default async function Page(){
 let initialSettings:Settings|undefined;
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL||publicConfig.url;
 const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||publicConfig.key;
 try{
  // Public settings only: never forward a visitor session into the shared cache.
  const response=await fetch(url+'/rest/v1/store_settings?select=data&id=eq.1',{headers:{apikey:key},next:{revalidate:30},signal:AbortSignal.timeout(5000)});
  if(response.ok){const rows=await response.json();if(Array.isArray(rows)&&rows[0]?.data&&Array.isArray(rows[0].data.categories)&&Array.isArray(rows[0].data.heroImages))initialSettings=rows[0].data}
 }catch{/* Keep the client fetch fallback available during a service outage. */}
 return <HomeLanding initialSettings={initialSettings}/>;
}
