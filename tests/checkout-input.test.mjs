import fs from 'node:fs';import ts from 'typescript';import assert from 'node:assert/strict';
const js=ts.transpileModule(fs.readFileSync('lib/checkout-input.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {normalizeCouponCode,normalizeCheckoutPhone}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
assert.equal(normalizeCouponCode(' ghaith \n'),'GHAITH');assert.equal(normalizeCouponCode('  '),'');assert.equal(normalizeCouponCode('SAVE-10'),'SAVE-10');assert.equal(normalizeCheckoutPhone('050 (123)-4567'),'0501234567');assert.equal(normalizeCheckoutPhone('+972 (50) 123-4567'),'+972501234567');
const source=fs.readFileSync('app/commerce-store.tsx','utf8');assert.ok(source.includes("rpc('checkout_quote',{customer:{...customer,phone:normalizeCheckoutPhone(customer.phone)}"));assert.ok(!source.includes('coupon.toUpperCase()'));
console.log('PASS coupon whitespace/case and phone formatting normalized consistently for quote and order without removing country codes.');
