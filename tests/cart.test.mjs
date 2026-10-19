import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=ts.transpileModule(fs.readFileSync('lib/catalog.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {initialProducts,totals,defaultSettings}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
assert.equal(new Set(initialProducts.map(p=>p.id)).size,initialProducts.length);
for(const p of initialProducts){for(const l of ['ar','en','he']){assert.ok(p.name[l]);assert.ok(p.description[l])}assert.ok(p.images.length);assert.ok(p.price>=0);assert.ok(Number.isInteger(p.stock))}
const a=initialProducts[0],b=initialProducts[1];
const cart=[{id:a.id,qty:2},{id:b.id,qty:1}];
const bill=totals(cart,initialProducts,25,10);
assert.equal(bill.subtotal,298);assert.equal(bill.discount,29.8);assert.equal(bill.total,293.2);
assert.equal(totals([],initialProducts,0).total,0);
assert.equal(totals(cart,initialProducts,30).total,328);
assert.ok(defaultSettings.cities.every(c=>c.fee>=0));
console.log('PASS: catalog integrity, all product translations, cart quantities, discounts, delivery fees, empty cart');
