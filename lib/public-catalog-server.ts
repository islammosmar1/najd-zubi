import { demoProducts } from './demo-products';
import { cache } from 'react';
import { publicConfig } from './public-config';
// Public-only credentials: metadata must never contain wholesale prices or customer data.
async function query(params:Record<string,string>){
 const url=new URL('/rest/v1/products',process.env.NEXT_PUBLIC_SUPABASE_URL||publicConfig.url);
 for(const [key,value] of Object.entries(params))url.searchParams.set(key,value);
 const response=await fetch(url,{headers:{apikey:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||publicConfig.key},cache:'no-store',signal:AbortSignal.timeout(8000)});
 if(!response.ok)throw new Error('Catalog temporarily unavailable');
 const rows:unknown=await response.json();if(!Array.isArray(rows))throw new Error('Invalid catalog response');return rows;
}
export type PublicProduct={id:string;data:{name?:{ar?:string};description?:{ar?:string};images?:string[];isSample?:boolean}};
export const getPublicProduct=cache(async(id:string):Promise<PublicProduct|null>=>{
 if(!id||id.length>100)return null;
 if(id.startsWith('demo-')){const p=demoProducts.find(p=>p.id===id);return p?{id:p.id,data:{name:p.name,description:p.description,images:p.images,isSample:true}}:null;}
 const rows=await query({select:'id,data',id:'eq.'+id,status:'eq.published',or:'(data->>isSample.is.null,data->>isSample.neq.true)',limit:'1'});
 return rows.length?rows[0] as PublicProduct:null;
});
export async function publicProductIds(){
 const ids:string[]=[];
 for(let offset=0;offset<50000;offset+=500){
  const rows=await query({select:'id',status:'eq.published',or:'(data->>isSample.is.null,data->>isSample.neq.true)',order:'id.asc',limit:'500',offset:String(offset)});
  for(const row of rows)if(row&&typeof row==='object'&&'id' in row&&typeof row.id==='string')ids.push(row.id);
  if(rows.length<500)return ids;
 }
 throw new Error('Sitemap requires pagination beyond current capacity');
}
