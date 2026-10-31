import type {Product,Settings} from './catalog';
export function normalizeSearch(value:string){return value.normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f\u0591-\u05c7\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed]/g,'').replace(/\u0640/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[^\p{L}\p{N}]+/gu,' ').trim();}
const synonyms=[
 ['شنطة','شنطه','شنط','شنطات','حقيبة','حقيبه','حقائب','حقيبه'],
 ['أسود','سوداء','سودا'],['أبيض','بيضاء','بيضا'],['أحمر','حمراء','حمرا'],
 ['بني','بنية'],['وردي','وردية','زهري','زهرية'],['رمادي','رمادية'],['عاجي','عاجية'],['خمري','خمرية','نبيتي'],
];
const aliases=new Map<string,string>();for(const group of synonyms)for(const word of group)aliases.set(normalizeSearch(word),normalizeSearch(group[0]));
function words(value:string){return normalizeSearch(value).split(' ').filter(Boolean).map(word=>{const plain=word.startsWith('ال')&&word.length>3?word.slice(2):word;return aliases.get(plain)||plain;});}
export function matchesProductSearch(product:Product,query:string,settings?:Settings){
 const wanted=words(query);if(!wanted.length)return true;
 const category=settings?.categories.find(c=>c[0]===product.category),parent=settings?.categories.find(c=>c[0]===category?.[4]);
 const haystack=words([...Object.values(product.name),product.brand,product.sku||'',...(product.keywords||[]),...(category?.slice(1,4)||[]),...(parent?.slice(1,4)||[])].join(' '));
 return wanted.every(term=>haystack.some(word=>word.includes(term)));
}
