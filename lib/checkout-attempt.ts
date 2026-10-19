export type CheckoutAttempt={fingerprint:string;id:string};
const key='najd-checkout-attempt-v1';
export async function checkoutAttempt(payload:unknown,previous:CheckoutAttempt|null,storage?:Pick<Storage,'getItem'|'setItem'>):Promise<CheckoutAttempt>{
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(payload)));
 const fingerprint=Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
 let saved=previous;try{saved=saved||JSON.parse(storage?.getItem(key)||'null')}catch{}
 const attempt=saved?.fingerprint===fingerprint&&/^[0-9a-f-]{36}$/i.test(saved.id)?saved:{fingerprint,id:crypto.randomUUID()};
 try{storage?.setItem(key,JSON.stringify(attempt))}catch{}
 return attempt;
}
export function clearCheckoutAttempt(storage?:Pick<Storage,'removeItem'>){try{storage?.removeItem(key)}catch{}}
