import type { Metadata } from 'next';
// Only an explicitly configured final domain can become a canonical origin.
export function finalSiteOrigin(value:unknown):string|undefined {
 if(typeof value!=='string'||!value.trim())return;
 try {
  const url=new URL(value.trim());const host=url.hostname.toLowerCase();
  if(url.protocol!=='https:'||url.username||url.password||url.port||url.pathname!=='/'||url.search||url.hash)return;
  if(!host.includes('.')||host.includes(':')||/^\d+(\.\d+){3}$/.test(host))return;
  if(/(^|\.)(localhost|local|test|invalid|example|example\.com|example\.org|example\.net|vercel\.app|netlify\.app|pages\.dev|workers\.dev|chatgpt\.site)$/.test(host))return;
  return url.origin;
 }catch{return;}
}
export const siteOrigin=finalSiteOrigin(process.env.NEXT_PUBLIC_SITE_URL);
export const storeTitle='NAJD ZUBI COSMETICS | شنط وإكسسوارات ومستحضرات تجميل';
export const storeDescription='اكتشفي تشكيلة نجد من الشنط والإكسسوارات والمكياج والعناية. تصفحي المنتجات والأسعار واختاري ما يناسبكِ مع توصيل حسب المدينة.';
export const shopTitle='تسوقي الشنط والمكياج والإكسسوارات | NAJD ZUBI';
export const shopDescription='تصفحي منتجات نجد من الشنط والمكياج والإكسسوارات والعناية، وقارني التفاصيل والألوان والأسعار وأضيفي اختياراتكِ إلى السلة.';
export function publicImage(value:unknown):string|undefined {
 if(typeof value!=='string')return;
 try{const url=new URL(value,siteOrigin);if(url.protocol==='https:'&&!url.username&&!url.password)return url.href}catch{}
}
export function pageMetadata(title:string,description:string,path:string,image?:string,index=true):Metadata {
 const url=siteOrigin?siteOrigin+path:undefined;
 const cover=publicImage(image)||publicImage('/brand/najd-bags-cosmetics-2026.png');
 return {title,description,alternates:index&&url?{canonical:url}:undefined,
  robots:{index,follow:true},
  openGraph:{type:'website',siteName:'NAJD ZUBI COSMETICS',locale:'ar_PS',title,description,url:index?url:undefined,images:cover?[{url:cover,alt:title}]:[]},
  twitter:{card:cover?'summary_large_image':'summary',title,description,images:cover?[cover]:[]}};
}
export function privateShopView(params:Record<string,unknown>){return ['admin','track','cart','wishlist','account','login','checkout','wholesale'].some(key=>Object.prototype.hasOwnProperty.call(params,key));}
export function xmlEscape(value:string){return value.replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]!))}
export function sitemapXml(ids:string[]){
 if(!siteOrigin)throw new Error('Set NEXT_PUBLIC_SITE_URL to the final HTTPS domain');
 const unique=[...new Set(ids)].filter(id=>id&&id.length<=100&&!id.startsWith('demo-'));
 if(unique.length>49998)throw new Error('Sitemap index required');
 const paths=['/','/shop',...unique.map(id=>'/product/'+encodeURIComponent(id))];
 return '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+paths.map(path=>'<url><loc>'+xmlEscape(siteOrigin+path)+'</loc></url>').join('')+'</urlset>';
}
export function robotsText(){return 'User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nDisallow: /account\nDisallow: /login\nDisallow: /checkout\nDisallow: /downloads/\n'+(siteOrigin?'Sitemap: '+siteOrigin+'/sitemap.xml\n':'');}
