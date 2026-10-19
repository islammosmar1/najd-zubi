import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
async function load(path){const js=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;return import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'))}
const {validateTaxonomy,categoryProducts,moveItem}=await load('lib/taxonomy.ts');
const {defaultSettings}=await load('lib/catalog.ts');
const settings={...defaultSettings,categories:[...defaultSettings.categories,['lips','شفاه','Lips','שפתיים','makeup']]};
assert.doesNotThrow(()=>validateTaxonomy(settings));
assert.throws(()=>validateTaxonomy({...settings,brands:['Dior',' dior ']}),/duplicate/);
assert.throws(()=>validateTaxonomy({...settings,categories:[...settings.categories,['bad','قسم','','','bad']]}),/parent/);
assert.throws(()=>validateTaxonomy({...settings,categories:[...settings.categories,['bad','قسم','','','missing']]}),/parent/);
assert.throws(()=>validateTaxonomy({...settings,categories:[...settings.categories,['third','قسم','','','lips']]}),/parent/);
const ps=[{id:'1',category:'makeup'},{id:'2',category:'lips'},{id:'3',category:'skin'}];
assert.deepEqual(categoryProducts(ps,settings,'makeup').map(p=>p.id),['1','2']);
assert.equal(categoryProducts(ps,settings,'all').length,3);
const original=['a','b','c'];assert.deepEqual(moveItem(original,2,-1),['a','c','b']);assert.deepEqual(original,['a','b','c']);assert.deepEqual(moveItem(original,0,-1),original);
console.log('PASS: duplicate brands, valid category parents, no category cycles, child filtering, stable nonmutating reorder');
const {homepageCategories,visibleCategoryProducts}=await load('lib/taxonomy.ts');
const home={...settings,categories:[['all','الكل','All','הכל',''],['bags','حقائب','Bags','תיקים',''],['mini','ميني','Mini','מיני','bags'],['makeup','مكياج','Makeup','איפור','']],categoryMeta:{mini:{home:true},makeup:{home:false}}};
assert.deepEqual(homepageCategories(home).map(c=>c[0]),['bags','mini']);
assert.equal(homepageCategories(home)[0][1],'حقائب');
const stock=[{id:'bag',category:'bags',stock:1,status:'published'},{id:'mini',category:'mini',stock:2,status:'published'},{id:'draft',category:'bags',stock:4,status:'draft'},{id:'sold',category:'bags',stock:0,status:'published'}];
assert.deepEqual(visibleCategoryProducts(stock,home,'bags').map(p=>p.id),['bag','mini']);
assert.deepEqual(visibleCategoryProducts(stock,{...home,categoryMeta:{mini:{hidden:true}}},'bags').map(p=>p.id),['bag']);
assert.equal(homepageCategories({...home,categoryMeta:{bags:{hidden:true},mini:{home:true},makeup:{home:false}}}).length,0);
console.log('PASS: homepage category order/names, optional children, hidden parents, assigned inventory and publication/stock eligibility.');

assert.deepEqual(visibleCategoryProducts([{id:'sample',category:'bags',stock:0,status:'published',isSample:true}],home,'bags').map(p=>p.id),[]);
const ordered=[{...stock[0],sortOrder:2},{...stock[1],sortOrder:1}];assert.deepEqual(visibleCategoryProducts(ordered,home,'bags').map(p=>p.id),['mini','bag']);assert.deepEqual(ordered.map(p=>p.id),['bag','mini']);

assert.deepEqual(visibleCategoryProducts([{id:'demo-old',category:'bags',stock:5,status:'published'}],home,'bags'),[]);
