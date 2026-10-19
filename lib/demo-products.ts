import type { Product } from './catalog';
// Display-only records. Never insert into the database or use them for checkout.
const items=[
 ['rose-bag','شنطة روز الكلاسيكية','Rose Classic Bag','תיק רוז קלאסי','bags',189,'/images/demo-burgundy-tophandle.webp'],
 ['everyday-bag','شنطة إيفري داي','Everyday Bag','תיק יומיומי','bags',149,'/images/demo-ivory-shoulder.webp'],
 ['mini-bag','شنطة ميني للمناسبات','Evening Mini Bag','תיק מיני לערב','bags',129,'/images/demo-black-chain.webp'],
 ['makeup-edit','مجموعة مكياج روز','Rose Makeup Edit','מארז איפור רוז','makeup',199,'/images/najd-makeup-hero-v1.webp'],
 ['lipstick','روج فيلفيت روز','Velvet Rose Lipstick','שפתון ורד קטיפתי','makeup',49,'/images/demo-lipstick.jpg'],
 ['palette','باليت الألوان الدافئة','Warm Tones Palette','פלטת גוונים חמים','makeup',89,'/images/demo-palette.jpg']
 ,...Array.from({length:21},(_,i)=>{
 const styles=[['شنطة كلاسيك خمرية','Burgundy Classic Bag','תיק בורדו קלאסי','demo-burgundy-tophandle'],['شنطة كتف عاجية','Ivory Shoulder Bag','תיק כתף שנהב','demo-ivory-shoulder'],['شنطة سهرة سوداء','Black Evening Bag','תיק ערב שחור','demo-black-chain'],['شنطة توت كراميل','Caramel Tote Bag','תיק טוט קרמל','demo-camel-tote']];
 const v=styles[i%4],n=String(Math.floor(i/4)+1).padStart(2,'0');
 return ['atelier-'+i,v[0]+' · '+n,v[1]+' · '+n,v[2]+' · '+n,'bags',129+(i%7)*20,'/images/'+v[3]+'.webp'] as const;
 })
] as const;
export const demoProducts:Product[]=items.map((x,i)=>({id:'demo-'+x[0],name:{ar:x[1],en:x[2],he:x[3]},description:{ar:'منتج وهمي لعرض تصميم المتجر. الصورة والسعر توضيحيان، وهو غير قابل للشراء.',en:'Fictional display product. Image and price are illustrative; this item cannot be purchased.',he:'פריט זה אינו זמין כרגע להזמנה.'},category:String(x[4]),brand:'NAJD',isSample:true,price:Number(x[5]),cost:0,oldPrice:0,stock:0,status:'draft',images:[x[6]],colors:[],sizes:[],best:i<18,featured:i%3!==1,isNew:i>=9||[1,2,4,5].includes(i)}));
