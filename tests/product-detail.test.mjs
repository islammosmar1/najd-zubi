import assert from 'node:assert/strict';import fs from 'node:fs';import ts from 'typescript';
const js=ts.transpileModule(fs.readFileSync('lib/product-detail.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {similarProducts}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const settings={categories:[['bags'],['mini','','','','bags'],['hidden']],categoryMeta:{hidden:{hidden:true}}};
const p={id:'a',category:'bags',brand:'A',price:100,status:'published',stock:2};
const rows=[p,{...p,id:'b',price:105},{...p,id:'child',category:'mini'},{...p,id:'draft',status:'draft'},{...p,id:'out',stock:0},{...p,id:'hidden',category:'hidden'},{...p,id:'other',category:'makeup',brand:'B'}];
assert.deepEqual(similarProducts(p,rows,settings).map(x=>x.id),['b','child']);
assert.equal(similarProducts(p,[p],settings).length,0);
console.log('PASS: similar products exclude self, hidden categories, drafts and sold-out stock; include child category.');

assert.ok(similarProducts({...p,isSample:true},rows,settings,true).every(p=>p.status==='published'), 'Sample recommendations must not expose drafts');
