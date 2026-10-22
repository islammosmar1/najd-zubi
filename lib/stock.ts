import type {Product} from './catalog';
export const soldOut=(p:Product)=>!p.isSample&&!p.id.startsWith('demo-')&&p.stock<=0;
