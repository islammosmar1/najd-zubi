import type { Product } from './catalog';
export function previousPrice(product:Pick<Product,'price'|'oldPrice'|'retailPrice'|'wholesale'>){
 const original=product.wholesale?product.retailPrice:product.oldPrice;
 return typeof original==='number'&&original>product.price?original:null;
}
