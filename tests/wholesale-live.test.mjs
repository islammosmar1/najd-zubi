import fs from 'node:fs';import assert from 'node:assert/strict';
const c=JSON.parse(fs.readFileSync('lib/public-config.ts','utf8').match(/= (\{.*\});/)[1]);
const h={apikey:c.key,'Content-Type':'application/json',Origin:'https://najd-cosmetics.glassyplume.chatgpt.site'};
for(const table of ['wholesale_accounts','wholesale_prices']){const r=await fetch(c.url+'/rest/v1/'+table+'?select=*',{headers:h});assert.ok([401,403].includes(r.status),table+' anonymous denied');}
for(const body of [{action:'update',id:'00000000-0000-0000-0000-000000000000',name:'Unauthorized probe',phone:'+970599000000'},{action:'create',name:'Unauthorized probe',phone:'+970599000000',password:'NotAnAccount-1234'},{action:'login',phone:'invalid',password:'invalid'}]){const r=await fetch(c.url+'/functions/v1/wholesale-accounts',{method:'POST',headers:h,body:JSON.stringify(body)});assert.equal(r.status,401);}
const r=await fetch(c.url+'/functions/v1/checkout',{method:'POST',headers:h,body:JSON.stringify({wholesale:true,customer:{},lines:[],city_index:0})});assert.equal(r.status,401);
console.log('PASS live wholesale HTTP: anonymous private tables and account creation blocked; invalid login rejected; unverified wholesale checkout denied. No accounts/orders created.');
