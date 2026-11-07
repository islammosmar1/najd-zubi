export type AdminLocation={tab:string;productId:string|null;orderId:string|null};
export function adminLocationKey(value:AdminLocation){return JSON.stringify([value.tab,value.productId,value.orderId]);}
export function readAdminLocation(state:unknown):AdminLocation|null {
  const value=(state as {najdAdmin?:AdminLocation}|null)?.najdAdmin;
  return value&&typeof value.tab==='string'&&(value.productId===null||typeof value.productId==='string')&&(value.orderId===null||typeof value.orderId==='string')?value:null;
}
