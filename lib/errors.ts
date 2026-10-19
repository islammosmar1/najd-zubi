/** Normalize thrown SDK objects without assuming all failures are Error instances. */
export function asError(value:unknown):Error {
 if(value instanceof Error)return value;
 if(value&&typeof value==='object'&&'message' in value&&typeof value.message==='string')return new Error(value.message);
 return new Error('تعذر إتمام العملية / Could not complete the operation');
}
