import type { Lang, Product } from './catalog';
export type AdminProductSort = 'newest' | 'oldest' | 'name' | 'price-low' | 'price-high';
export function sortAdminProducts(products: Product[], sort: AdminProductSort, lang: Lang): Product[] {
  const timestamp = (p: Product) => {const n=Date.parse(p.createdAt||'');return Number.isFinite(n)?n:null;};
  return [...products].sort((a,b)=>{
    if(sort==='name') return (a.name[lang]||a.name.ar).localeCompare(b.name[lang]||b.name.ar,lang);
    if(sort==='price-low') return a.price-b.price;
    if(sort==='price-high') return b.price-a.price;
    const x=timestamp(a),y=timestamp(b);
    if(x===null) return y===null?0:1;
    if(y===null) return -1;
    return sort==='oldest'?x-y:y-x;
  });
}
