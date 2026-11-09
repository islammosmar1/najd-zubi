import type {CartItem} from './catalog';
export type LiveCartItem=Pick<CartItem,'id'|'qty'|'color'|'size'>;
export type LiveSnapshot={count:number;updated_at:string;visitors:{id:string;started_at:string;last_seen:string;page:string;cart:LiveCartItem[]}[]};
const tokenKey='najd-live-visitor-v1';
export function liveVisitorToken(storage:Pick<Storage,'getItem'|'setItem'>,makeId=()=>crypto.randomUUID()):string{
 const saved=storage.getItem(tokenKey);
 if(saved&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(saved))return saved;
 const token=makeId();storage.setItem(tokenKey,token);return token;
}
export function liveVisitorPage(path:string,search:string):string|null{
 if(new URLSearchParams(search).has('admin'))return null;
 return path==='/'||path==='/shop'||/^\/product\/[A-Za-z0-9_%.-]{1,160}$/.test(path)?path:null;
}
export function liveCart(items:CartItem[]):LiveCartItem[]{
 return items.filter(x=>typeof x.id==='string'&&x.id.length<=150&&Number.isInteger(x.qty)&&x.qty>0&&x.qty<=999).slice(0,100)
 .map(x=>({id:x.id,qty:x.qty,color:typeof x.color==='string'?x.color.slice(0,100):'',size:typeof x.size==='string'?x.size.slice(0,100):'Standard'}));
}
