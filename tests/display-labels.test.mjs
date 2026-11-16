import fs from 'node:fs';import ts from 'typescript';import assert from 'node:assert/strict';
const source=ts.transpileModule(fs.readFileSync('lib/display-labels.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {sizeLabel,localityLabel,checkoutMessage}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
assert.equal(sizeLabel('Standard','ar'),'قياس موحّد');assert.equal(sizeLabel('Standard','he'),'מידה אחידה');assert.equal(sizeLabel('M','he'),'M');
for(const [lang,name] of [['ar','القدس'],['en','Jerusalem'],['he','ירושלים']])assert.equal(localityLabel('القدس / ירושלים / Jerusalem',lang),name);
assert.equal(localityLabel('باقة الحطب / Baqat al Hatab','he'),'Baqat al Hatab');assert.equal(localityLabel('رام الله','en'),'رام الله');
assert.equal(checkoutMessage('Coupon conditions not met','en'),'Coupon conditions not met');assert.ok(!/[A-Za-z]/.test(checkoutMessage('Coupon conditions not met','he')));assert.equal(checkoutMessage('Custom message','en'),'Custom message');
console.log('PASS localized size labels, locality script selection and fallback, coupon errors, and unchanged stored identifiers.');
