import type {Settings} from './catalog';
export type HeroMedia={type:'image'|'video';url:string;poster?:string};
export function safeMediaUrl(value:string){return /^https:\/\/[^\s]+$/i.test(value)||/^\/(?!\/)[^\s]*$/.test(value)}
export function heroMedia(settings:Settings):HeroMedia[]{
 const slides=settings.heroMedia?.filter(s=>['image','video'].includes(s.type)&&safeMediaUrl(s.url));
 return slides?.length?slides:settings.heroImages.filter(safeMediaUrl).map(url=>({type:'image',url}));
}
