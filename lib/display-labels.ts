import type {Lang} from './catalog';
export function sizeLabel(value:string|undefined,lang:Lang){
 if(!value)return '';
 if(value==='Standard')return lang==='ar'?'قياس موحّد':lang==='he'?'מידה אחידה':'Standard';
 return value;
}
export function localityLabel(value:string,lang:Lang){
 const parts=value.split('/').map(x=>x.trim()).filter(Boolean);
 const script=lang==='ar'?/[ء-ي]/:lang==='he'?/[א-ת]/:/[A-Za-z]/;
 return parts.find(p=>script.test(p))||parts.find(p=>/[A-Za-z]/.test(p))||value;
}
const checkoutMessages:Record<string,[string,string]>={
 'Coupon not valid':['الكود غير صالح لبيانات الطلب أو انتهت صلاحيته','קוד ההנחה אינו תקף לפרטי ההזמנה או פג תוקפו'],
 'Coupon conditions not met':['شروط كود الخصم غير متحققة للمنتجات في السلة','תנאי קוד ההנחה אינם מתקיימים למוצרים בסל'],
 'Insufficient stock':['الكمية المطلوبة غير متوفرة','הכמות המבוקשת אינה במלאי'],
 'Insufficient variant stock':['الكمية المطلوبة غير متوفرة لهذا اللون أو المقاس','הכמות אינה במלאי לצבע או למידה שנבחרו'],
 'Product unavailable':['هذا المنتج غير متاح حالياً','המוצר אינו זמין כרגע'],
 'Delivery unavailable':['التوصيل غير متاح لهذه المدينة','המשלוח אינו זמין לעיר זו'],
 'Minimum order not met':['لم تصلي للحد الأدنى لقيمة الطلب','לא הגעת לסכום ההזמנה המינימלי'],
 'Coupons cannot be combined with wholesale prices':['لا يمكن جمع كود الخصم مع سعر الجملة','לא ניתן לשלב קוד הנחה עם מחיר סיטונאי'],
 'Store connection unavailable':['تعذر الاتصال بالمتجر، حاولي مجدداً','לא ניתן להתחבר לחנות, נסו שוב'],
 'Could not calculate total':['تعذر حساب الإجمالي، حاولي مجدداً','לא ניתן לחשב את הסכום, נסו שוב'],
};
export function checkoutMessage(message:string,lang:Lang){return checkoutMessages[message]?.[lang==='he'?1:0]&&lang!=='en'?checkoutMessages[message][lang==='he'?1:0]:message}
