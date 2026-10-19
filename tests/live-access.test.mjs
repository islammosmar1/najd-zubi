import fs from 'node:fs';import assert from 'node:assert/strict';
const raw=fs.readFileSync('lib/public-config.ts','utf8');const config=JSON.parse(raw.match(/= (\{.*\});/)[1]);
const h={apikey:config.key,'Content-Type':'application/json',Origin:'https://najd-cosmetics.glassyplume.chatgpt.site'};
async function request(path,method='GET',body){const r=await fetch(config.url+path,{method,headers:h,...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json()}}
const settings=await request('/rest/v1/store_settings?select=data');assert.equal(settings.status,200);assert.equal(settings.body[0].data.storeName,'NAJD COSMETICS');
const catalog=await request('/rest/v1/products?select=id,price,stock');assert.equal(catalog.status,200);
assert.ok([401,403].includes((await request('/rest/v1/orders?select=id')).status));
assert.ok([401,403].includes((await request('/rest/v1/product_costs?select=id')).status));
assert.ok([401,403].includes((await request('/rest/v1/products','POST',{id:'__najd_access_probe__',price:1,stock:1,data:{name:{ar:'Access probe'},images:[],sizes:['Standard'],colors:[]}})).status));
assert.ok([401,403].includes((await request('/rest/v1/rpc/place_order','POST',{customer:{},lines:[],city_index:0,coupon_code:''})).status));
assert.ok([401,403].includes((await request('/rest/v1/rpc/claim_store_owner','POST',{})).status));
const upload=await fetch(config.url+'/storage/v1/object/products/__najd_access_probe__.webp',{method:'POST',headers:{...h,'Content-Type':'image/webp'},body:new Uint8Array([1,2,3])});assert.ok([400,401,403].includes(upload.status));
const checkout=await request('/functions/v1/checkout','POST',{request_id:crypto.randomUUID(),customer:{name:'Test',phone:'+972500000000',address:'Test address'},lines:[],city_index:0});assert.equal(checkout.status,400);
const ai=await request('/functions/v1/beauty-ai','POST',{message:'hello',lang:'en'});assert.equal(ai.status,503);
console.log('PASS live HTTP: catalog/settings readable; anonymous orders, costs, product writes, owner claim and direct checkout blocked; invalid checkout rejected; unconfigured AI returns 503.');
