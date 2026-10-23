import type {Lang} from './catalog';
import type {HeroMedia} from './hero-media';

export type HeroCopy={eyebrow:string;title:string;accent:string;description:string;button:string;quizLabel:string};
export const heroCopyLimits:Record<keyof HeroCopy,number>={eyebrow:70,title:40,accent:40,description:220,button:35,quizLabel:60};
export function heroCopy(media:HeroMedia|undefined,index:number,lang:Lang):HeroCopy{
 const defaults:Record<Lang,HeroCopy>={
 ar:{eyebrow:index===0?'THE ART OF BEING YOU':index===1?'CARRY SOMETHING BEAUTIFUL':'THE BEAUTY OF SELF-EXPRESSION',title:index===0?'تفاصيل تكمّل':'شنط ترافق',accent:index===0?'أناقتكِ.':'كل لحظاتكِ.',description:index===0?'شنط بتفاصيل أنيقة، ولمسات تختارينها على ذوقك. اكتشفي عالم نجد.':'تصاميم يومية وشنط مناسبات، اختاري القطعة التي تشبهكِ.',button:'اكتشفي التشكيلة',quizLabel:'ما الذي يُشبه جمالك؟'},
 en:{eyebrow:index===0?'THE ART OF BEING YOU':index===1?'CARRY SOMETHING BEAUTIFUL':'THE BEAUTY OF SELF-EXPRESSION',title:index===0?'Details that complete':'Bags for',accent:index===0?'your elegance.':'every moment.',description:index===0?'Beautiful bags and considered details. Discover your NAJD edit.':'Everyday bags and evening favorites. Find the one that feels like you.',button:'Explore the collection',quizLabel:'What feels like your kind of beauty?'},
 he:{eyebrow:index===0?'THE ART OF BEING YOU':index===1?'CARRY SOMETHING BEAUTIFUL':'THE BEAUTY OF SELF-EXPRESSION',title:index===0?'פרטים שמשלימים':'תיקים לכל',accent:index===0?'את האלגנטיות שלך.':'רגע שלך.',description:index===0?'תיקים אלגנטיים ופרטים שנבחרו בטעם. גלי את NAJD.':'תיקים ליום ולערב. מצאי את התיק שמתאים לך.',button:'גלי את הקולקציה',quizLabel:'מה מרגיש כמו היופי שלך?'}
 };
 const result={...defaults[lang]};
 for(const key of Object.keys(result) as (keyof HeroCopy)[]){
  const value=media?.copy?.[lang]?.[key];
  if(typeof value==='string')result[key]=value.slice(0,heroCopyLimits[key]);
 }
 return result;
}
