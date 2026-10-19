import { Globe,Camera,MessageCircle,Music2 } from 'lucide-react';
import type { Lang,Settings } from '../lib/catalog';
import { safeSocialUrl } from '../lib/social-links';
export default function FooterContact({settings,lang}:{settings:Settings;lang:Lang}){
 const links=settings.socialLinks||{};
 const rows=[['Facebook',links.facebook,Globe],['Instagram',links.instagram,Camera],['TikTok',links.tiktok,Music2],['WhatsApp',links.whatsapp||(/^[1-9][0-9]{7,14}$/.test(settings.whatsapp)?'https://wa.me/'+settings.whatsapp:''),MessageCircle]] as const;
 return <div className="nz-footer-contact"><nav className="nz-socials" aria-label={lang==='ar'?'روابط التواصل الاجتماعي':'Social links'}>{rows.map(([label,url,Icon])=>{const href=safeSocialUrl(url);return href?<a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label}><Icon size={18}/><span>{label}</span></a>:null})}</nav><div className="nz-developer"><span>{lang==='ar'?'صُمّم وطُوّر بواسطة':lang==='he'?'עיצוב ופיתוח':'Designed & developed by'}</span><strong dir="ltr">ENG. ISLAM MOSMAR</strong><a href="tel:+972598188707" dir="ltr">+972598188707</a><a href="mailto:islammosmar2@gmail.com" dir="ltr">islammosmar2@gmail.com</a></div></div>
}
