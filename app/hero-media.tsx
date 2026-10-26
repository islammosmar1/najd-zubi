'use client';
import {useEffect,useRef} from 'react';
import type {HeroMedia} from '../lib/hero-media';
import {portableAssetUrl} from '../lib/assets';
export default function HeroVisual({media,paused=false,className,alt}:{media:HeroMedia;paused?:boolean;className?:string;alt:string}){
 const ref=useRef<HTMLVideoElement>(null);
 useEffect(()=>{const video=ref.current;if(!video)return;if(paused)video.pause();else void video.play().catch(()=>{});return()=>video.pause()},[media.url,paused]);
 return media.type==='video'?<video ref={ref} className={className} src={media.url} poster={media.poster?portableAssetUrl(media.poster):undefined} muted playsInline loop preload="metadata" aria-label={alt}/>:<img fetchPriority="high" decoding="async" className={className} src={portableAssetUrl(media.url)} alt={alt} width={1536} height={1024}/>;
}
