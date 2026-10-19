import type { Product,Settings } from './catalog';
export function validateTaxonomy(settings:Settings){
 const ids=new Set<string>();
 for(const c of settings.categories){if(!c[0]||ids.has(c[0]))throw Error('Duplicate category ID');ids.add(c[0]);if(!c[1]?.trim())throw Error('أضيفي اسم القسم بالعربية / Add an Arabic category name');}
 for(const c of settings.categories){if(c[4]&&(!ids.has(c[4])||c[4]===c[0]||settings.categories.find(p=>p[0]===c[4])?.[4]))throw Error('اختاري قسمًا رئيسيًا صالحًا / Choose a valid parent');}
 const brands=settings.brands.map(b=>b.trim().toLocaleLowerCase());if(brands.some(b=>!b)||new Set(brands).size!==brands.length)throw Error('اسم البراند فارغ أو مكرر / Empty or duplicate brand');
}
export function categoryProducts(products:Product[],settings:Settings,id:string){const ids=new Set([id,...settings.categories.filter(c=>c[4]===id).map(c=>c[0])]);return sortProducts(products.filter(p=>id==='all'||ids.has(p.category))); }
export function moveItem<T>(items:T[],index:number,delta:number){const next=[...items];const target=index+delta;if(target<0||target>=next.length)return next;[next[index],next[target]]=[next[target],next[index]];return next;}

export function homepageCategories(settings:Settings){return settings.categories.filter(c=>c[0]!=='all'&&!settings.categoryMeta?.[c[0]]?.hidden&&!settings.categoryMeta?.[c[4]]?.hidden&&(settings.categoryMeta?.[c[0]]?.home??!c[4]));}
export function visibleCategoryProducts(products:Product[],settings:Settings,id:string){return categoryProducts(products,settings,id).filter(p=>p.status==='published'&&p.stock>0&&!p.isSample&&!p.id.startsWith('demo-')&&!settings.categoryMeta?.[p.category]?.hidden&&!settings.categoryMeta?.[settings.categories.find(c=>c[0]===p.category)?.[4]||'']?.hidden);}

export function sortProducts(products:Product[]){return [...products].sort((a,b)=>(Number.isFinite(a.sortOrder)?a.sortOrder!:Number.MAX_SAFE_INTEGER)-(Number.isFinite(b.sortOrder)?b.sortOrder!:Number.MAX_SAFE_INTEGER));}
