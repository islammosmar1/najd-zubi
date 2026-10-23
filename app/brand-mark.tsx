import './brand-mark.css';
export default function BrandMark({home=false}:{home?:boolean}){return <span className={home?'brand-image brand-image-home':'brand-image brand-image-nz'} dir="ltr"><img src={home?'/brand/najd-bags-cosmetics-2026.png':'/brand/najd-zubi-2026.png'} alt={home?'NAJD Bags & Cosmetics':'NZ — NAJD ZUBI'} width={1500} height={1200}/></span>}
