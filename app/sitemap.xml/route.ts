import { publicProductIds } from '../../lib/public-catalog-server';
import { sitemapXml, siteOrigin } from '../../lib/seo';
export async function GET(){
 if(!siteOrigin)return new Response('Configure NEXT_PUBLIC_SITE_URL with the final HTTPS domain and rebuild.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
 try{return new Response(sitemapXml(await publicProductIds()),{headers:{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'public, max-age=300'}})}catch{return new Response('Sitemap temporarily unavailable',{status:503,headers:{'Cache-Control':'no-store','Retry-After':'300'}})}
}
