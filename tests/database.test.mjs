process.on('uncaughtException',e=>{console.error(e.message,e.where||'');process.exit(1)});
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import fs from 'node:fs';import assert from 'node:assert/strict';
const db=new PGlite({extensions:{pgcrypto}});
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid,bucket_id text);alter table storage.objects enable row level security;`);
for(const f of ['001_store.sql','002_commerce.sql','003_ai.sql','20261012190923_wholesale_delivery.sql','20261013071819_catalog_security_hardening.sql','20261015072134_completed_purchase_reviews.sql','20261015222726_checkout_retry_and_atomic_product.sql','20261016080344_category_product_order.sql','20261016083213_launch_variant_stock.sql','20261016153502_delivery_governorates_without_gaza.sql','20261016155124_audit_product_integrity.sql','20261022091113_wrapping_and_restock.sql','20261022092939_per_item_gift_wrapping.sql'])await db.exec(fs.readFileSync('supabase/migrations/'+f,'utf8'));
await db.exec(fs.readFileSync('supabase/seed.sql','utf8'));
await db.exec(`grant usage on schema public,auth to anon,authenticated;grant select,insert,update,delete on all tables in schema public to anon,authenticated;grant usage on all sequences in schema public to authenticated;insert into auth.users(id) values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');insert into admins(id) values('11111111-1111-4111-8111-111111111111');insert into admins(id,role,permissions) values('22222222-2222-4222-8222-222222222222','products',array['products.read','products.write']);insert into coupons(code,kind,value,max_uses) values('SAVE10','percent',10,1);update product_costs set cost=40;`);
const claim=async(id='',aal='aal1')=>{await db.query(`select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)`,[id,JSON.stringify({aal})])};
const customer={name:'Test Customer',phone:'+972500000001',address:'Test address only'},lines=[{id:'najd-1',qty:2,color:'#812d42',size:'Standard'}];
const rpc=async(name,args)=>{const params=args.map((_,i)=>'$'+(i+1)).join(',');return (await db.query(`select ${name}(${params}) as value`,args.map(a=>name!=='reorder_category_products'&&a!==null&&typeof a==='object'?JSON.stringify(a):a))).rows[0].value};
await db.exec('set role anon');
assert.equal((await db.query('select count(*)::int n from orders')).rows[0].n,0);
await assert.rejects(()=>rpc('edit_order',['fake',1,{}]),/permission denied|Forbidden/);
const quote=await rpc('checkout_quote',[customer,lines,0,'SAVE10']);assert.equal(quote.total,180.2);assert.equal(quote.cost_total,undefined);
await assert.rejects(()=>rpc('place_order',[customer,lines,0,'SAVE10']),/permission denied/);await db.exec('set role service_role');
const order=await rpc('place_order',[customer,lines,0,'SAVE10']);assert.equal(order.total,180.2);assert.equal(order.items[0].unit_cost,undefined);assert.equal(order.cost_total,undefined);
assert.equal((await db.query("select stock from products where id='najd-1'")).rows[0].stock,10);
await assert.rejects(()=>rpc('place_order',[customer,lines,0,'SAVE10']),/Coupon not valid/);
await assert.rejects(()=>rpc('place_order',[customer,[{...lines[0],qty:999}],0,'']),/Insufficient stock/);
await assert.rejects(()=>rpc('place_order',[customer,[{...lines[0],qty:-1}],0,'']),/Invalid quantity/);
assert.equal((await db.query("select stock from products where id='najd-1'")).rows[0].stock,10);
await db.exec('set role anon');const tampered=await rpc('checkout_quote',[customer,[{...lines[0],qty:1,price:0.01}],0,'']);assert.equal(tampered.subtotal,89);
await db.exec('set role authenticated');await claim('22222222-2222-4222-8222-222222222222');assert.equal((await db.query('select count(*)::int n from orders')).rows[0].n,0);await assert.rejects(()=>rpc('edit_order',[order.id,1,{status:'cancelled'}]),/Forbidden/);
await claim('11111111-1111-4111-8111-111111111111');
const edited=await rpc('edit_order',[order.id,1,{items:[{...lines[0],qty:3}],delivery:25,status:'preparing'}]);assert.equal(edited.subtotal,267);assert.equal(edited.version,2);assert.equal((await db.query("select stock from products where id='najd-1'")).rows[0].stock,9);
await assert.rejects(()=>rpc('edit_order',[order.id,1,{status:'cancelled'}]),/Order changed/);
await rpc('edit_order',[order.id,2,{status:'cancelled'}]);assert.equal((await db.query("select stock from products where id='najd-1'")).rows[0].stock,12);
await rpc('edit_order',[order.id,3,{status:'cancelled'}]);assert.equal((await db.query("select stock from products where id='najd-1'")).rows[0].stock,12);
assert.ok((await db.query('select count(*)::int n from audit_log')).rows[0].n>0);
await db.exec("update admins set require_mfa=true where id='11111111-1111-4111-8111-111111111111'");assert.equal(await rpc('can',['orders.read']),false);await claim('11111111-1111-4111-8111-111111111111','aal2');assert.equal(await rpc('can',['orders.read']),true);
console.log('PASS PostgreSQL: RLS roles, private costs, checkout totals, coupon limits, stock rollback, overselling prevention, price tampering, edits, cancellation idempotency, concurrency version, audit, MFA gate.');
await db.exec('reset role');
await db.exec("insert into auth.users(id) values('33333333-3333-4333-8333-333333333333');insert into wholesale_accounts(id,name,phone) values('33333333-3333-4333-8333-333333333333','Wholesale Test','+972500000099');insert into wholesale_prices(id,price) values('najd-1',50);");
await db.exec('set role anon');await claim('');assert.equal((await db.query('select count(*)::int n from wholesale_prices')).rows[0].n,0);
await assert.rejects(()=>rpc('place_verified_order',['33333333-3333-4333-8333-333333333333',customer,lines,0,'']),/permission denied/);
await db.exec('set role authenticated');await claim('33333333-3333-4333-8333-333333333333');
assert.equal((await db.query('select price from wholesale_prices')).rows[0].price,'50.00');
assert.equal((await rpc('checkout_quote',[customer,lines,0,''])).subtotal,100);
await db.query("update wholesale_accounts set active=false");assert.equal((await db.query('select active from wholesale_accounts')).rows[0].active,true);
await assert.rejects(()=>db.query("insert into wholesale_prices values('najd-2',1)"),/row-level security/);
await assert.rejects(()=>rpc('checkout_quote',[customer,lines,0,'SAVE10']),/Coupons cannot/);
await db.exec('set role service_role');const wh=await rpc('place_verified_order',['33333333-3333-4333-8333-333333333333',{...customer,phone:'+972500000099'},lines,0,'']);assert.equal(wh.subtotal,100);assert.equal(wh.items[0].price,50);
await db.exec("update wholesale_accounts set active=false where id='33333333-3333-4333-8333-333333333333'");
await assert.rejects(()=>rpc('place_verified_order',['33333333-3333-4333-8333-333333333333',customer,lines,0,'']),/inactive/);
await db.exec('set role authenticated');await claim('33333333-3333-4333-8333-333333333333');assert.equal((await db.query('select count(*)::int n from wholesale_prices')).rows[0].n,0);
await db.exec('reset role');await db.exec("update store_settings set data=jsonb_set(data,'{cities,0,enabled}','false')");
await assert.rejects(()=>rpc('checkout_quote',[customer,lines,0,'']),/Delivery unavailable/);
console.log('PASS wholesale: protected prices, approved pricing quote and order, no self approval or price edits, inactive-account denial, coupon separation, disabled delivery.');


await db.exec('reset role');await claim();
await db.exec("update store_settings set data=jsonb_set(data,'{cities,0,enabled}','true');update store_settings set data=jsonb_set(data,'{categoryMeta}', '{\"makeup\":{\"hidden\":true}}');");
await db.exec('set role anon');assert.equal((await db.query("select count(*)::int n from products where data->>'category'='makeup'")).rows[0].n,0);
await assert.rejects(()=>rpc('checkout_quote',[customer,lines,0,'']),/Product unavailable/);
await db.exec('reset role');console.log('PASS hidden-category API reads and checkout rejected.');


// Admin CRUD and permission boundaries exercised in isolated PostgreSQL.
await db.exec('reset role');await claim('11111111-1111-4111-8111-111111111111','aal2');
await db.exec("update store_settings set data=jsonb_set(data,'{categoryMeta}','{}')");
await db.exec('set role authenticated');
await db.query("insert into products(id,price,stock,status,data) values('qa-admin-product',25,3,'draft',$1)",[JSON.stringify({name:{ar:'اختبار',en:'Test',he:'בדיקה'},category:'bags',images:[],sizes:['Standard'],colors:[]})]);
await db.exec("insert into product_costs values('qa-admin-product',5);update products set price=30,status='published' where id='qa-admin-product';insert into wholesale_prices values('qa-admin-product',20)");
assert.equal((await db.query("select price from products where id='qa-admin-product'")).rows[0].price,'30.00');
await claim('33333333-3333-4333-8333-333333333333');
assert.equal((await db.query('select count(*)::int n from admins')).rows[0].n,0);
assert.equal((await db.query('select count(*)::int n from orders')).rows[0].n,0);
assert.equal((await db.query('select count(*)::int n from product_costs')).rows[0].n,0);
assert.equal((await db.query("update products set price=1 where id='qa-admin-product' returning id")).rows.length,0);
await db.exec('reset role');await db.exec("update wholesale_accounts set active=true where id='33333333-3333-4333-8333-333333333333'");await db.exec('set role authenticated');
assert.equal((await rpc('checkout_quote',[customer,[{id:'qa-admin-product',qty:2,size:'Standard',color:''}],0,''])).subtotal,40);
await db.exec('reset role');await db.exec("delete from wholesale_prices where id='qa-admin-product'");await db.exec('set role authenticated');
assert.equal((await rpc('checkout_quote',[customer,[{id:'qa-admin-product',qty:2,size:'Standard',color:''}],0,''])).subtotal,60,'Fallback to retail on the server');
await db.exec('reset role');await db.exec("update products set stock=0 where id='qa-admin-product'");await db.exec('set role authenticated');
await assert.rejects(()=>rpc('checkout_quote',[customer,[{id:'qa-admin-product',qty:1,size:'Standard',color:''}],0,'']),/Insufficient stock/);
await claim('11111111-1111-4111-8111-111111111111','aal2');
await db.exec("delete from products where id='qa-admin-product'");assert.equal((await db.query("select count(*)::int n from products where id='qa-admin-product'")).rows[0].n,0);
console.log('PASS admin CRUD/costs/prices; wholesale cannot read admin, orders, costs or alter products; server wholesale totals, retail fallback and zero-stock refusal.');


await db.exec('reset role');await claim('');
await db.exec(`insert into orders(id,name,phone,city,address,items,subtotal,delivery,discount,total,status) values ('QA-COMPLETED-REVIEW','QA Customer','+972500009999','QA City','QA Address','[{"id":"najd-1","qty":1,"price":89}]',89,20,0,109,'completed')`);
await db.exec('set role anon');
await assert.rejects(()=>rpc('submit_review',['najd-1','QA-COMPLETED-REVIEW','+972500008888',5,'Valid review']),/delivered purchase/);
const review=await rpc('submit_review',['najd-1','QA-COMPLETED-REVIEW','+972500009999',5,'Valid review']);assert.equal(review.score,5);
await assert.rejects(()=>rpc('submit_review',['najd-1','QA-COMPLETED-REVIEW','+972500009999',5,'Duplicate review']),/duplicate key/);
console.log('PASS completed-order review accepted; wrong phone and duplicate review rejected.');



await db.exec('reset role');await claim('11111111-1111-4111-8111-111111111111','aal2');await db.exec('set role authenticated');
const atomicProduct={id:'qa-atomic',name:{ar:'منتج اختبار',en:'Test',he:'בדיקה'},description:{ar:'',en:'',he:''},images:['/images/test.webp'],category:'bags',price:100,cost:40,stock:5,status:'published',sizes:['Standard'],colors:[]};
await rpc('save_product_atomic',[atomicProduct,70,true]);
assert.equal((await db.query("select price from wholesale_prices where id='qa-atomic'")).rows[0].price,'70.00');
await assert.rejects(()=>rpc('save_product_atomic',[{...atomicProduct,price:999,cost:999},1000000000000,true]),/overflow/);
assert.equal((await db.query("select price from products where id='qa-atomic'")).rows[0].price,'100.00');assert.equal((await db.query("select cost from product_costs where id='qa-atomic'")).rows[0].cost,'40.00');
assert.equal((await db.query("select data ? 'cost' leaked from products where id='qa-atomic'")).rows[0].leaked,false);
await rpc('save_product_atomic',[{...atomicProduct,price:110},null,false]);assert.equal((await db.query("select price from wholesale_prices where id='qa-atomic'")).rows[0].price,'70.00');
await rpc('save_product_atomic',[atomicProduct,null,true]);assert.equal((await db.query("select count(*)::int n from wholesale_prices where id='qa-atomic'")).rows[0].n,0);
await db.exec('reset role');await db.exec("update store_settings set data=jsonb_set(data,'{cities}','[{\"name\":\"QA\",\"fee\":20,\"enabled\":true}]') where id=1");await claim('');await db.exec('set role service_role');
const requestId='66666666-6666-4666-8666-666666666666';const retryCustomer={name:'Retry QA',phone:'+972500007777',address:'QA address'};const retryLines=[{id:'qa-atomic',qty:1,size:'Standard',color:''}];
const once=await rpc('place_order_once',[requestId,null,retryCustomer,retryLines,0,'']);const again=await rpc('place_order_once',[requestId,null,retryCustomer,retryLines,0,'']);assert.equal(once.id,again.id);assert.equal((await db.query("select stock from products where id='qa-atomic'")).rows[0].stock,4);assert.equal(once.cost_total,undefined);assert.equal(once.items[0].unit_cost,undefined);
await assert.rejects(()=>rpc('place_order_once',[requestId,null,{...retryCustomer,name:'Changed'},retryLines,0,'']),/different checkout details/);
const failedId='77777777-7777-4777-8777-777777777777';await assert.rejects(()=>rpc('place_order_once',[failedId,null,retryCustomer,[{...retryLines[0],qty:999}],0,'']),/Insufficient stock/);
await db.exec('reset role');assert.equal((await db.query('select count(*)::int n from najd_private.checkout_attempts where request_id=$1',[failedId])).rows[0].n,0);
await db.exec('set role anon');await assert.rejects(()=>rpc('place_order_once',[requestId,null,retryCustomer,retryLines,0,'']),/permission denied/);await assert.rejects(()=>rpc('save_product_atomic',[atomicProduct,1,true]),/permission denied/);await assert.rejects(()=>db.query('select * from najd_private.checkout_attempts'),/permission denied/);
console.log('PASS atomic product/wholesale/cost rollback, private cost stripping, price preservation/removal; checkout replay returns same order with one stock debit, changed payload rejected, failed checkout rolled back, client access denied.');


await db.exec('set role authenticated');await claim('22222222-2222-4222-8222-222222222222');
const categoryIds=(await db.query("select id from products where data->>'category'='makeup' order by id")).rows.map(p=>p.id);
const beforeSort=await db.query("select id,price,stock from products where data->>'category'='makeup' order by id");
await rpc('reorder_category_products',['makeup',[...categoryIds].reverse()]);
assert.deepEqual((await db.query("select id from products where data->>'category'='makeup' order by (data->>'sortOrder')::int")).rows.map(p=>p.id),[...categoryIds].reverse());
assert.deepEqual((await db.query("select id,price,stock from products where data->>'category'='makeup' order by id")).rows,beforeSort.rows);
await assert.rejects(()=>rpc('reorder_category_products',['makeup',[categoryIds[0],categoryIds[0]]]),/Category changed/);
await assert.rejects(()=>rpc('reorder_category_products',['bags',categoryIds]),/Category changed/);
await claim('33333333-3333-4333-8333-333333333333');await assert.rejects(()=>rpc('reorder_category_products',['makeup',categoryIds]),/Forbidden/);
await db.exec('set role anon');await assert.rejects(()=>rpc('reorder_category_products',['makeup',categoryIds]),/permission denied/);
console.log('PASS category order: persistence, unchanged stock/prices, invalid category/duplicates rejected, staff permission and anonymous denial.');



await db.exec('reset role');await claim('11111111-1111-4111-8111-111111111111','aal2');await db.exec('set role authenticated');
const variantProduct={...atomicProduct,id:'qa-variants',stock:99,colors:['black','red'],sizes:['S'],variants:[{color:'black',size:'S',stock:1},{color:'red',size:'S',stock:3}]};
await rpc('save_product_atomic',[variantProduct,65,true]);assert.equal((await db.query("select stock from products where id='qa-variants'")).rows[0].stock,4);
await assert.rejects(()=>rpc('save_product_atomic',[{...variantProduct,variants:[{color:'black',size:'S',stock:-1}]},null,false]),/Invalid variant/);
const vCustomer={name:'Variant QA',phone:'+972500008888',address:'QA variant address'};const black=[{id:'qa-variants',qty:1,color:'black',size:'S'}];
await db.exec('set role service_role');await claim('');const vOrder=await rpc('place_verified_order',[null,vCustomer,black,0,'']);
assert.equal((await db.query("select stock from products where id='qa-variants'")).rows[0].stock,3);
assert.equal((await db.query("select (data->'variants'->0->>'stock')::int n from products where id='qa-variants'")).rows[0].n,0);
await assert.rejects(()=>rpc('place_verified_order',[null,vCustomer,black,0,'']),/variant stock/);
await db.exec('set role authenticated');await claim('11111111-1111-4111-8111-111111111111','aal2');
const changed=await rpc('edit_order',[vOrder.id,1,{items:[{...black[0],color:'red',qty:2}]}]);
assert.equal((await db.query("select stock from products where id='qa-variants'")).rows[0].stock,2);
let variants=(await db.query("select data->'variants' v from products where id='qa-variants'")).rows[0].v;assert.equal(variants[0].stock,1);assert.equal(variants[1].stock,1);
await assert.rejects(()=>rpc('edit_order',[vOrder.id,changed.version,{items:[{...black[0],qty:2}]}]),/variant stock/);
assert.equal((await db.query("select stock from products where id='qa-variants'")).rows[0].stock,2);
await rpc('edit_order',[vOrder.id,changed.version,{status:'cancelled'}]);assert.equal((await db.query("select stock from products where id='qa-variants'")).rows[0].stock,4);
await db.exec('reset role');await db.exec("update store_settings set data=jsonb_set(data,'{cities}',data->'cities'||'[{\"name\":\"غزة\",\"district\":\"غزة\",\"enabled\":true,\"fee\":20}]'::jsonb) where id=1");await db.exec('set role anon');await claim('');
await assert.rejects(()=>rpc('checkout_quote',[vCustomer,[{...black[0],color:'red'}],1,'']),/Delivery unavailable/);
await db.exec('set role authenticated');await claim('22222222-2222-4222-8222-222222222222');
await assert.rejects(()=>db.query("update products set stock=999 where id='qa-variants'"),/Variant stock total mismatch/);
assert.equal((await db.query("select stock from products where id='qa-variants'")).rows[0].stock,4);
// A product-only employee must not orphan historical orders.
await db.exec('set role authenticated');await claim('22222222-2222-4222-8222-222222222222');
await assert.rejects(()=>db.query("delete from products where id='qa-variants'"),/Archive products referenced by orders/);
assert.equal((await db.query("select count(*)::int n from products where id='qa-variants'")).rows[0].n,1);
await db.query("update products set status='archived' where id='qa-variants'");
console.log('PASS order history: product-only staff cannot delete referenced products; archiving remains allowed.');
// Restore the complete isolated PostgreSQL data directory into a second database.
// This verifies local schema/data recovery, not Supabase Auth/Storage backup recovery.
await db.exec('reset role');
const beforeRestore=(await db.query("select (select count(*) from orders)::int orders,(select count(*) from products)::int products,(select count(*) from wholesale_prices)::int prices")).rows[0];
const recoveryImage=await db.dumpDataDir();
const recovered=new PGlite({extensions:{pgcrypto},loadDataDir:recoveryImage});
const afterRestore=(await recovered.query("select (select count(*) from orders)::int orders,(select count(*) from products)::int products,(select count(*) from wholesale_prices)::int prices")).rows[0];
assert.deepEqual(afterRestore,beforeRestore);
assert.equal((await recovered.query("select stock from products where id='qa-variants'")).rows[0].stock,4);
await recovered.exec('set role anon');assert.equal((await recovered.query('select count(*)::int n from orders')).rows[0].n,0);
await recovered.close();console.log('PASS isolated database restore: table counts, stock and anonymous RLS survive full data-directory recovery. Supabase managed backup/Storage/Auth recovery NOT tested.');

await db.exec('reset role');await claim();
await db.exec("update store_settings set data=jsonb_set(jsonb_set(data,'{categoryMeta}','{}'),'{giftWrap}','{\"enabled\":true,\"fee\":5}'); update products set stock=10 where id='najd-2';");
const wrapLines=[{id:'najd-2',qty:1,color:'',size:'Standard'}];
const wrappedLines=wrapLines.map(x=>({...x,gift_wrap:true,gift_wrap_unit_fee:0,gift_wrap_fee:0}));
const plain=await rpc('checkout_quote',[customer,wrapLines,0,'']);
const wrapped=await rpc('checkout_quote',[customer,wrappedLines,0,'']);
assert.equal(wrapped.total,plain.total+5);assert.equal(wrapped.gift_wrap_fee,5);
const mixed=await rpc('quote_order',[customer,[{...wrappedLines[0],qty:2},{...wrapLines[0],qty:1}],0,'']);
assert.equal(mixed.gift_wrap_fee,10);assert.equal(mixed.items[0].gift_wrap_unit_fee,5);assert.equal(mixed.items[1].gift_wrap,false);
assert.equal(mixed.items[1].gift_wrap_fee,0);

await db.exec("update store_settings set data=jsonb_set(data,'{giftWrap,fee}','7.5')");
assert.equal((await rpc('checkout_quote',[customer,wrappedLines,0,''])).total,plain.total+7.5);
await db.exec('set role service_role');
const giftOrder=await rpc('place_order',[{...customer,phone:'+970599000876'},wrappedLines,0,'']);
assert.equal(giftOrder.gift_wrap,true);assert.equal(giftOrder.gift_wrap_fee,7.5);
await db.exec('set role authenticated');await claim('11111111-1111-4111-8111-111111111111','aal2');
const unchanged=await rpc('edit_order',[giftOrder.id,1,{status:'preparing'}]);assert.equal(unchanged.total,giftOrder.total);
const resized=await rpc('edit_order',[giftOrder.id,2,{items:[{...giftOrder.items[0],qty:2,gift_wrap_unit_fee:0}]}]);
assert.equal(resized.gift_wrap_fee,15);assert.equal(resized.items[0].gift_wrap_unit_fee,7.5);

await db.exec('reset role');await claim();await db.exec("update store_settings set data=jsonb_set(data,'{giftWrap,enabled}','false');");
await assert.rejects(()=>rpc('checkout_quote',[customer,wrappedLines,0,'']),/wrapping unavailable/);
await db.exec("update products set stock=0 where id='najd-2'; revoke all on restock_requests from anon;set role anon");
await rpc('request_restock',['najd-2','+970599000877']);
await rpc('request_restock',['najd-2','+970599000877']);
await assert.rejects(()=>db.query('select * from restock_requests'),/permission denied/);
await assert.rejects(()=>rpc('request_restock',['najd-2','0599000877']),/Invalid request/);
await db.exec('set role authenticated');await claim('22222222-2222-4222-8222-222222222222');
assert.equal((await db.query('select count(*)::int n from restock_requests')).rows[0].n,0);
await claim('11111111-1111-4111-8111-111111111111','aal2');
assert.equal((await db.query('select count(*)::int n from restock_requests')).rows[0].n,1);
await db.exec("update restock_requests set contacted=true");
await db.exec("reset role;update products set stock=1 where id='najd-2';set role anon");
await assert.rejects(()=>rpc('request_restock',['najd-2','+970599000878']),/Product unavailable/);
await db.exec('reset role');
console.log('PASS wrapping: server price, admin price change, receipt persistence, editing totals and disabled option. Restock: international phone, deduplication, private contacts, staff permissions and availability guard.');

await db.close();console.log('PASS variant stock: total synchronization, option oversell denial, atomic edits and rollback, cancellation restores correct options.');
