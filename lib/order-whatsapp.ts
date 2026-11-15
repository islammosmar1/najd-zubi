import type {Lang,Order} from './catalog';

export function orderWhatsAppUrl(phone:string,order:Order,lang:Lang){
 if(!/^[1-9]\d{7,14}$/.test(phone)||!order.id)return null;
 const t=(ar:string,en:string,he:string)=>lang==='ar'?ar:lang==='he'?he:en;
 const message=[t('طلب مسجّل في موقع نجد','Order recorded on NAJD','הזמנה שנרשמה באתר NAJD'),`${t('رقم الطلب','Order number','מספר הזמנה')}: ${order.id}`,order.name,order.phone,order.city,order.region||'',order.address,...order.items.map(i=>`${i.product?.name?.[lang]||i.product?.name?.ar||i.id} × ${i.qty}${i.color?' · '+i.color:''}${i.size?' · '+i.size:''} · ${(i.price??i.product?.price??0)*i.qty} ₪${i.gift_wrap?' · '+t('تغليف','Gift wrap','אריזה'):''}`),`${t('مجموع المنتجات','Subtotal','סכום מוצרים')}: ${order.subtotal} ₪`,`${t('الخصم','Discount','הנחה')}: ${order.discount} ₪`,`${t('التوصيل','Delivery','משלוח')}: ${order.delivery} ₪`,`${t('التغليف','Gift wrap','אריזה')}: ${order.gift_wrap_fee||0} ₪`,`${t('الإجمالي','Total','סה״כ')}: ${order.total} ₪`,order.notes||''].filter(Boolean).join('\n');
 return 'https://wa.me/'+phone+'?text='+encodeURIComponent(message);
}
