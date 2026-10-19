import type { Product } from './catalog';
export type Variant={color:string;size:string;stock:number};
export function variantStock(p:Product,color:string,size:string){return p.variants?.length?(p.variants.find(v=>v.color===color&&v.size===size)?.stock||0):p.stock}
export function prepareVariants(p:Product):Product{
 if(!p.variants)return p;
 if(!p.variants.length||p.variants.length>100)throw Error('أضيفي مخزون الخيارات / Add variant inventory');
 const keys=new Set<string>();let stock=0;
 for(const v of p.variants){const key=JSON.stringify([v.color,v.size]);if(keys.has(key)||!Number.isInteger(v.stock)||v.stock<0||!(p.colors.length?p.colors:['']).includes(v.color)||!(p.sizes.length?p.sizes:['Standard']).includes(v.size))throw Error('راجعي ألوان ومقاسات وكميات الخيارات / Check variant options and quantities');keys.add(key);stock+=v.stock;}
 return {...p,variants:p.variants.map(v=>({...v,stock:p.isSample?0:v.stock})),stock:p.isSample?0:stock};
}
