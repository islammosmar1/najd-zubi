import type { Settings } from './catalog';
export const paletteDefaults={light:{background:'#f8f5ef',card:'#fffcf7',text:'#462633',accent:'#582238',gold:'#ddbd94',navbar:'#fffcf7',ticker:'#481b2b',tickerText:'#f7e6c8'},dark:{background:'#20151b',card:'#30212a',text:'#f7eee8',accent:'#d79bae',gold:'#ddbd94',navbar:'#271b22',ticker:'#481b2b',tickerText:'#f7e6c8'}};
export type Palette=typeof paletteDefaults.light;
export function themeVariables(settings:Settings,dark=false):Record<string,string>{
 const colors=settings.theme?.[dark?'dark':'light'];const vars:Record<string,string>={};
 const keys:Record<keyof Palette,string[]>={background:['--bg','--paper','--custom-background'],card:['--surface','--panel','--custom-card'],text:['--text','--ink','--custom-text'],accent:['--wine','--custom-accent'],gold:['--gold'],navbar:['--custom-navbar'],ticker:['--custom-ticker'],tickerText:['--custom-ticker-text']};
 for(const key of Object.keys(keys) as (keyof Palette)[]){const value=colors?.[key];if(value&&/^#[0-9a-f]{6}$/i.test(value))for(const name of keys[key])vars[name]=value}
 return vars;
}
export function bagsFirst(categories:string[][]){return [...categories].sort((a,b)=>Number(b[0]==='all')-Number(a[0]==='all')||Number(b[0]==='bags')-Number(a[0]==='bags'))}
export function visibleBrands(settings:Settings,category?:string,home=false){return settings.brands.filter(name=>{
 const meta=settings.brandMeta?.[name];if(meta?.hidden||(home&&meta?.home===false))return false;
 if(!category||category==='all'||!meta?.categoryIds?.length)return true;
 const parent=settings.categories.find(c=>c[0]===category)?.[4];
 return meta.categoryIds.some(id=>id===category||id===parent||settings.categories.some(c=>c[0]===id&&c[4]===category));
})}
export type CollectionKind='best'|'featured'|'isNew';
export function orderCollection(products:import('./catalog').Product[],settings:Settings,kind:CollectionKind){const ids=settings.collectionOrder?.[kind]||[];const ranks=new Map(ids.map((id,i)=>[id,i]));return [...products].sort((a,b)=>(ranks.get(a.id)??Number.MAX_SAFE_INTEGER)-(ranks.get(b.id)??Number.MAX_SAFE_INTEGER)||(a.sortOrder??Number.MAX_SAFE_INTEGER)-(b.sortOrder??Number.MAX_SAFE_INTEGER));}
