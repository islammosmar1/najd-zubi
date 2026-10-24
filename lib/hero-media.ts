import type {Settings,Lang} from './catalog';
export type HeroMedia={type:'image'|'video';url:string;poster?:string;hidden?:boolean;copy?:Partial<Record<Lang,Partial<import('./hero-copy').HeroCopy>>>};
export function safeMediaUrl(value:string){return /^https:\/\/[^\s]+$/i.test(value)||/^\/(?!\/)[^\s]*$/.test(value)}
export function heroMedia(settings:Settings):HeroMedia[]{
 const slides=settings.heroMedia?.filter(s=>!s.hidden&&['image','video'].includes(s.type)&&safeMediaUrl(s.url));
 return slides??settings.heroImages.filter(safeMediaUrl).map(url=>({type:'image',url}));
}
