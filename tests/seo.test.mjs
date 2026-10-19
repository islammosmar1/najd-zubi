import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
const transpile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function loadSeo(env={}){const exports={};vm.runInNewContext(transpile(fs.readFileSync('lib/seo.ts','utf8')),{exports,URL,process:{env}});return exports;}
const unconfigured=loadSeo({VERCEL_PROJECT_PRODUCTION_URL:'ignored.vercel.app'});
assert.equal(unconfigured.siteOrigin,undefined);
assert.equal(unconfigured.pageMetadata('Home','Description','/').alternates,undefined);
assert.equal(unconfigured.pageMetadata('Home','Description','/').openGraph.url,undefined);
assert.equal(unconfigured.publicImage('/cover.webp'),undefined);
assert.throws(()=>unconfigured.sitemapXml([]),/final HTTPS domain/);
assert.ok(!unconfigured.robotsText().includes('Sitemap:'));
for(const value of ['http://store.org','https://localhost','https://127.0.0.1','https://[::1]','https://store.local','https://preview.vercel.app','https://store.chatgpt.site','https://example.com','https://user:pass@store.org','https://store.org/path','https://store.org?x=1','https://store.org#hash'])assert.equal(unconfigured.finalSiteOrigin(value),undefined,value);
const exports=loadSeo({NEXT_PUBLIC_SITE_URL:'https://seo-fixture.org/'});
assert.equal(exports.siteOrigin,'https://seo-fixture.org');
const home=exports.pageMetadata('Home','Home description','/');
assert.equal(home.alternates.canonical,'https://seo-fixture.org/');
assert.equal(home.robots.index,true);
assert.equal(home.openGraph.url,home.alternates.canonical);
assert.equal(home.twitter.description,'Home description');
assert.equal(exports.pageMetadata('Shop','Shop description','/shop').alternates.canonical,'https://seo-fixture.org/shop');
for(const key of ['admin','track','wishlist','cart','account','login','checkout','wholesale']){
 assert.equal(exports.privateShopView({category:'bags',[key]:''}),true);
 const privatePage=exports.pageMetadata('Private','Private','/shop',undefined,false);
 assert.equal(privatePage.robots.index,false);assert.equal(privatePage.alternates,undefined);
}
assert.equal(exports.privateShopView({category:'bags',utm_source:'search'}),false);
assert.ok(exports.robotsText().includes('Allow: /\n'));
assert.ok(exports.robotsText().includes('Disallow: /api/'));
assert.ok(exports.robotsText().includes('Sitemap: https://seo-fixture.org/sitemap.xml'));
assert.ok(!exports.robotsText().includes('Disallow: /shop'));
assert.equal(exports.publicImage('javascript:alert(1)'),undefined);
assert.equal(exports.publicImage('data:text/html,test'),undefined);
assert.equal(exports.publicImage('/images/bag.webp'),exports.siteOrigin+'/images/bag.webp');
const xml=exports.sitemapXml(['bag<&"']);assert.ok(xml.includes('/product/bag%3C%26%22'));assert.ok(!xml.includes('<&'));assert.ok(xml.includes('/shop'));
const filteredXml=exports.sitemapXml(['real','real','demo-sample']);
assert.equal((filteredXml.match(/<url>/g)||[]).length,3);assert.ok(!filteredXml.includes('demo-sample'));
assert.throws(()=>exports.sitemapXml(Array.from({length:49999},(_,i)=>String(i))),/Sitemap index/);
const routeSource=fs.readFileSync('app/sitemap.xml/route.ts','utf8').replace(/^import .*;\r?\n/gm,'');
async function sitemapRoute(seo,fetchIds){const route={};vm.runInNewContext(transpile(routeSource),{exports:route,Response,siteOrigin:seo.siteOrigin,sitemapXml:seo.sitemapXml,publicProductIds:fetchIds});return route.GET();}
let calls=0;
assert.equal((await sitemapRoute(unconfigured,async()=>{calls++;return []})).status,503);assert.equal(calls,0);
const good=await sitemapRoute(exports,async()=>['real']);assert.equal(good.status,200);assert.match(good.headers.get('content-type'),/application\/xml/);assert.match(await good.text(),/seo-fixture.org\/product\/real/);
const unavailable=await sitemapRoute(exports,async()=>{throw Error('private diagnostic')});assert.equal(unavailable.status,503);assert.ok(!(await unavailable.text()).includes('private diagnostic'));
const catalog={};let response=[],lastUrl;
vm.runInNewContext(transpile(fs.readFileSync('lib/public-catalog-server.ts','utf8').replace(/^import .*;\n/gm,'')),{exports:catalog,cache:f=>f,process:{env:{}},publicConfig:{url:'https://catalog.test',key:'public-test-key'},demoProducts:[{id:'demo-known',name:{ar:'حقيبة'},description:{ar:'غير متاح حاليًا'},images:[]}],URL,AbortSignal,fetch:async(url,options)=>{lastUrl=url;assert.equal(options.cache,'no-store');assert.equal(options.headers.apikey,'public-test-key');return {ok:true,json:async()=>response}}});
assert.equal(await catalog.getPublicProduct('missing'),null);
const priorUrl=lastUrl;assert.equal(await catalog.getPublicProduct('demo-bag'),null);assert.equal(lastUrl,priorUrl);const displayProduct=await catalog.getPublicProduct('demo-known');assert.equal(displayProduct.data.isSample,true);assert.equal(lastUrl,priorUrl);

response=[{id:'product-1',data:{name:{ar:'حقيبة'}}}];assert.equal((await catalog.getPublicProduct('product-1')).id,'product-1');assert.equal(lastUrl.searchParams.get('status'),'eq.published');assert.equal(lastUrl.searchParams.get('or'),'(data->>isSample.is.null,data->>isSample.neq.true)');
response=[{id:'p&1'}];assert.deepEqual(Array.from(await catalog.publicProductIds()),['p&1']);assert.equal(lastUrl.searchParams.get('or'),'(data->>isSample.is.null,data->>isSample.neq.true)');
response={error:'bad response'};await assert.rejects(()=>catalog.getPublicProduct('test'),/Invalid catalog response/);
console.log('PASS SEO: safe image URLs, escaped sitemap IDs, missing products, public-only catalog requests, sample exclusion includes rows without sample flag, malformed response rejection.');
