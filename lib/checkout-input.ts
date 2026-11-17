export function normalizeCouponCode(value:string){return value.trim().toUpperCase()}
export function normalizeCheckoutPhone(value:string){return value.replace(/[\s()-]/g,'')}
