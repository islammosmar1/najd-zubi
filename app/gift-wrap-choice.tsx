import type {Lang} from '../lib/catalog';
export default function GiftWrapChoice({checked,fee,qty,lang,onChange}:{checked:boolean;fee:number;qty:number;lang:Lang;onChange:(value:boolean)=>void}){
 const t=(a:string,b:string,c:string)=>lang==='ar'?a:lang==='he'?c:b;
 return <label className="check-label gift-wrap-option"><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)}/><span>🎁 {t('تغليف شفاف مع شبرة لهذا المنتج','Transparent wrap with ribbon for this item','עטיפה שקופה עם סרט למוצר זה')}<strong>{fee} ₪ {t('للقطعة','per piece','ליחידה')}{qty>1&&<> · {t('المجموع','Total','סה״כ')}: {(fee*qty).toFixed(2)} ₪</>}</strong></span></label>;
}
