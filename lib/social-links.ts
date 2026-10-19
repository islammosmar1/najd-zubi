export type SocialLinks={facebook?:string;instagram?:string;tiktok?:string;whatsapp?:string};
export function safeSocialUrl(value:unknown):string|undefined{if(typeof value!=='string'||!value.trim())return;try{const u=new URL(value.trim());if(u.protocol!=='https:'||u.username||u.password)return;return u.href}catch{return}}
